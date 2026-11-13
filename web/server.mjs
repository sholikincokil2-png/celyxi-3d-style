import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { normalizeStoryboard } from "./shared/storyboard.mjs";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIST_DIR = path.join(__dirname, "dist");
const OUT_DIR = path.join(ROOT_DIR, "out");
const WEB_JOBS_DIR = path.join(OUT_DIR, "web_jobs");
const SHOWCASE_MP4_PATH = path.join(OUT_DIR, "celyxi_10s_silent.mp4");
const BLENDER_SCRIPT_PATH = path.join(ROOT_DIR, "blender_pipeline", "generate_from_idea.py");

const PORT = Number(process.env.PORT || 3080);
const DEFAULT_BLENDER_PATHS = [
  process.env.BLENDER_BIN,
  "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe",
  "blender",
].filter(Boolean);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
};

/** @type {Map<string, any>} */
const jobs = new Map();
/** @type {string[]} */
const jobQueue = [];
let activeJobId = null;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(text),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const err = new Error("Request body too large");
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

async function resolveBlenderBinary() {
  for (const candidate of DEFAULT_BLENDER_PATHS) {
    if (path.isAbsolute(candidate)) {
      try {
        await fsp.access(candidate, fs.constants.F_OK);
        return candidate;
      } catch {
        continue;
      }
    }
    try {
      const { stdout } = await execFileAsync(candidate, ["--version"], { timeout: 5000 });
      if (stdout && stdout.includes("Blender")) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function checkBlenderHealth() {
  const bin = await resolveBlenderBinary();
  if (!bin) {
    return { available: false, version: null, path: null };
  }
  try {
    const { stdout } = await execFileAsync(bin, ["--version"], { timeout: 5000 });
    const firstLine = stdout.split(/\r?\n/)[0]?.trim() || "Blender";
    return { available: true, version: firstLine, path: bin };
  } catch (err) {
    return { available: false, version: null, path: bin, error: String(err.message || err) };
  }
}

async function checkFfmpegHealth() {
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
    const firstLine = stdout.split(/\r?\n/)[0]?.trim() || "ffmpeg";
    return { available: true, version: firstLine };
  } catch (err) {
    return { available: false, version: null, error: String(err.message || err) };
  }
}

async function serveFileWithRange(req, res, filePath, contentType = "application/octet-stream") {
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    sendJson(res, 404, { error: "File not found" });
    return;
  }
  if (!stat.isFile()) {
    sendJson(res, 404, { error: "Not a file" });
    return;
  }

  const fileSize = stat.size;
  const rangeHeader = req.headers.range;
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) {
      res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      res.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
      res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": chunkSize,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    ...baseHeaders,
    "Content-Length": fileSize,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

async function countRenderedFrames(framesDir) {
  try {
    const entries = await fsp.readdir(framesDir);
    let count = 0;
    for (const name of entries) {
      if (name.endsWith(".png")) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function appendJobLog(job, line) {
  if (!line) return;
  job.logs.push(line);
  if (job.logs.length > 60) {
    job.logs.splice(0, job.logs.length - 60);
  }
}

function runCommandAsync(bin, args, job, onStdoutLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: ROOT_DIR,
      windowsHide: true,
    });

    let stdoutBuf = "";
    let stderrBuf = "";

    const flushLines = (buf, isErr = false) => {
      const lines = buf.split(/\r?\n/);
      const rem = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          appendJobLog(job, isErr ? `[err] ${trimmed}` : trimmed);
          if (onStdoutLine) onStdoutLine(trimmed);
        }
      }
      return rem;
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuf = flushLines(stdoutBuf + chunk.toString("utf8"), false);
    });
    child.stderr.on("data", (chunk) => {
      stderrBuf = flushLines(stderrBuf + chunk.toString("utf8"), true);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (stdoutBuf.trim()) appendJobLog(job, stdoutBuf.trim());
      if (stderrBuf.trim()) appendJobLog(job, `[err] ${stderrBuf.trim()}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(bin)} exited with code ${code}`));
      }
    });
  });
}

async function processRenderQueue() {
  if (activeJobId || jobQueue.length === 0) return;
  const nextId = jobQueue.shift();
  const job = jobs.get(nextId);
  if (!job) {
    processRenderQueue();
    return;
  }

  activeJobId = nextId;
  job.status = "rendering_3d";
  job.phase = "Blender 5.1 Cycles 3D Pass";
  job.startedAt = new Date().toISOString();

  const poller = setInterval(async () => {
    const count = await countRenderedFrames(job.framesDir);
    job.renderedFrames = count;
  }, 800);

  try {
    const blenderBin = await resolveBlenderBinary();
    if (!blenderBin) {
      throw new Error("Blender 5.1.2 binary not found");
    }
    try {
      await fsp.access(BLENDER_SCRIPT_PATH, fs.constants.F_OK);
    } catch {
      throw new Error(`Missing Blender pipeline script: ${BLENDER_SCRIPT_PATH}`);
    }

    const blenderArgs = [
      "-b",
      "-P",
      BLENDER_SCRIPT_PATH,
      "--",
      "--storyboard",
      job.storyboardPath,
      "--out-frames",
      job.framesDir,
      "--res",
      job.renderOptions.res,
      "--samples",
      String(job.renderOptions.samples),
      "--bounces",
      String(job.renderOptions.bounces),
    ];

    appendJobLog(job, `Launching Blender: ${blenderBin} ${blenderArgs.join(" ")}`);
    await runCommandAsync(blenderBin, blenderArgs, job, (line) => {
      const fraMatch = /Fra:(\d+)/.exec(line);
      if (fraMatch) {
        job.currentFrameHint = Number(fraMatch[1]);
      }
    });

    job.renderedFrames = await countRenderedFrames(job.framesDir);
    if (job.renderedFrames === 0) {
      throw new Error("Blender completed but produced 0 PNG frames");
    }

    job.status = "encoding_video";
    job.phase = "FFmpeg Silent H.264 Encode";
    const ffmpegArgs = [
      "-y",
      "-framerate",
      String(job.storyboard.fps || 30),
      "-i",
      path.join(job.framesDir, "frame_%04d.png"),
      "-vf",
      "scale=1080:1920:flags=lanczos",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      "-an",
      job.videoPath,
    ];

    appendJobLog(job, `Encoding MP4: ffmpeg ${ffmpegArgs.join(" ")}`);
    await runCommandAsync("ffmpeg", ffmpegArgs, job);

    job.status = "completed";
    job.phase = "Ready";
    job.finishedAt = new Date().toISOString();
  } catch (err) {
    job.status = "failed";
    job.phase = "Failed";
    job.error = String(err.message || err);
    job.finishedAt = new Date().toISOString();
    appendJobLog(job, `Job failed: ${job.error}`);
  } finally {
    clearInterval(poller);
    activeJobId = null;
    processRenderQueue();
  }
}

function serializeJob(job) {
  const total = job.totalFrames || 300;
  let progress = 0;
  if (job.status === "completed") {
    progress = 100;
  } else if (job.status === "encoding_video") {
    progress = 96;
  } else if (job.status === "rendering_3d") {
    progress = Math.min(94, Math.round((job.renderedFrames / total) * 94));
  }
  return {
    jobId: job.jobId,
    status: job.status,
    phase: job.phase,
    renderedFrames: job.renderedFrames,
    totalFrames: total,
    currentFrameHint: job.currentFrameHint || 0,
    progress,
    error: job.error || null,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    videoUrl: job.status === "completed" ? `/api/jobs/${job.jobId}/video` : null,
    storyboardUrl: `/api/jobs/${job.jobId}/storyboard`,
    logsTail: job.logs.slice(-12),
  };
}

function isSafeJobId(id) {
  return /^[a-zA-Z0-9_-]{6,64}$/.test(id);
}

async function handleApiRequest(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    const [blender, ffmpeg] = await Promise.all([checkBlenderHealth(), checkFfmpegHealth()]);
    const scriptReady = fs.existsSync(BLENDER_SCRIPT_PATH);
    const showcaseReady = fs.existsSync(SHOWCASE_MP4_PATH);
    const distReady = fs.existsSync(path.join(WEB_DIST_DIR, "index.html"));
    sendJson(res, 200, {
      ok: true,
      service: "celyxi-3d-studio-api",
      port: PORT,
      uptimeSec: Math.round(process.uptime()),
      blender,
      ffmpeg,
      pipelineScript: { exists: scriptReady, path: BLENDER_SCRIPT_PATH },
      showcase: { exists: showcaseReady, url: "/api/showcase/celyxi_10s_silent.mp4" },
      frontendBuilt: distReady,
      activeJobId,
      queuedJobs: jobQueue.length,
    });
    return;
  }

  if (pathname === "/api/storyboard" && req.method === "POST") {
    const body = await readJsonBody(req);
    const storyboard = normalizeStoryboard(body);
    sendJson(res, 200, storyboard);
    return;
  }

  if (pathname === "/api/render" && req.method === "POST") {
    const body = await readJsonBody(req);
    const storyboard = normalizeStoryboard(body.storyboard || body);

    const jobId = `celyxi_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const jobDir = path.join(WEB_JOBS_DIR, jobId);
    const framesDir = path.join(jobDir, "frames");
    const storyboardPath = path.join(jobDir, "storyboard.json");
    const videoPath = path.join(jobDir, "output.mp4");

    await fsp.mkdir(framesDir, { recursive: true });
    await fsp.writeFile(storyboardPath, JSON.stringify(storyboard, null, 2), "utf8");

    const resOpt = typeof body.res === "string" && /^\d+x\d+$/.test(body.res) ? body.res : "360x640";
    const samplesOpt = Number.isFinite(Number(body.samples)) ? Math.max(1, Math.min(32, Number(body.samples))) : 4;
    const bouncesOpt = Number.isFinite(Number(body.bounces)) ? Math.max(1, Math.min(4, Number(body.bounces))) : 1;

    const job = {
      jobId,
      status: "queued",
      phase: "Queued for Blender 5.1",
      renderedFrames: 0,
      totalFrames: storyboard.totalFrames || 300,
      currentFrameHint: 0,
      createdAt: new Date().toISOString(),
      jobDir,
      framesDir,
      storyboardPath,
      videoPath,
      storyboard,
      renderOptions: { res: resOpt, samples: samplesOpt, bounces: bouncesOpt },
      logs: [],
    };

    jobs.set(jobId, job);
    jobQueue.push(jobId);
    processRenderQueue();

    sendJson(res, 202, {
      ok: true,
      ...serializeJob(job),
      pollUrl: `/api/jobs/${jobId}`,
      storyboard,
    });
    return;
  }

  const jobMatch = /^\/api\/jobs\/([^/]+)(?:\/(video|storyboard))?$/.exec(pathname);
  if (jobMatch && (req.method === "GET" || req.method === "HEAD")) {
    const [, jobId, sub] = jobMatch;
    if (!isSafeJobId(jobId)) {
      sendJson(res, 400, { error: "Invalid jobId" });
      return;
    }

    let job = jobs.get(jobId);
    if (!job) {
      const diskDir = path.join(WEB_JOBS_DIR, jobId);
      const diskStoryboard = path.join(diskDir, "storyboard.json");
      const diskVideo = path.join(diskDir, "output.mp4");
      const diskFrames = path.join(diskDir, "frames");
      if (!fs.existsSync(diskDir)) {
        sendJson(res, 404, { error: "Job not found" });
        return;
      }
      const renderedFrames = await countRenderedFrames(diskFrames);
      const hasVideo = fs.existsSync(diskVideo);
      job = {
        jobId,
        status: hasVideo ? "completed" : "unknown",
        phase: hasVideo ? "Ready" : "Recovered from disk",
        renderedFrames,
        totalFrames: 300,
        createdAt: null,
        jobDir: diskDir,
        framesDir: diskFrames,
        storyboardPath: diskStoryboard,
        videoPath: diskVideo,
        logs: [],
      };
    } else if (job.status === "rendering_3d") {
      job.renderedFrames = await countRenderedFrames(job.framesDir);
    }

    if (sub === "video") {
      if (!fs.existsSync(job.videoPath)) {
        sendJson(res, 404, { error: "Rendered video not ready yet" });
        return;
      }
      await serveFileWithRange(req, res, job.videoPath, "video/mp4");
      return;
    }

    if (sub === "storyboard") {
      if (!fs.existsSync(job.storyboardPath)) {
        sendJson(res, 404, { error: "Storyboard not found" });
        return;
      }
      await serveFileWithRange(req, res, job.storyboardPath, "application/json; charset=utf-8");
      return;
    }

    sendJson(res, 200, { ok: true, ...serializeJob(job) });
    return;
  }

  if (pathname === "/api/showcase/celyxi_10s_silent.mp4" && (req.method === "GET" || req.method === "HEAD")) {
    await serveFileWithRange(req, res, SHOWCASE_MP4_PATH, "video/mp4");
    return;
  }

  sendJson(res, 404, { error: `Unknown API route: ${req.method} ${pathname}` });
}

async function handleStaticRequest(req, res, pathname) {
  if (!fs.existsSync(WEB_DIST_DIR)) {
    if (pathname === "/" || pathname === "/index.html") {
      sendText(
        res,
        200,
        "Celyxi 3D Video Studio API is running. Build the frontend (`cd web && npm run build`) to serve the UI at /.",
      );
      return;
    }
    sendJson(res, 404, { error: "Frontend dist not built yet" });
    return;
  }

  const normalized = path.posix.normalize(pathname).replace(/^\/+/, "");
  let targetPath = path.resolve(WEB_DIST_DIR, normalized || "index.html");
  if (!targetPath.startsWith(WEB_DIST_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(targetPath);
    if (stat.isDirectory()) {
      targetPath = path.join(targetPath, "index.html");
      stat = await fsp.stat(targetPath);
    }
  } catch {
    targetPath = path.join(WEB_DIST_DIR, "index.html");
    try {
      stat = await fsp.stat(targetPath);
    } catch {
      sendJson(res, 404, { error: "index.html not found in web/dist" });
      return;
    }
  }

  const ext = path.extname(targetPath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(targetPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(reqUrl.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, pathname);
      return;
    }
    await handleStaticRequest(req, res, pathname);
  } catch (err) {
    const status = err.statusCode || 500;
    sendJson(res, status, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`[celyxi-studio] Server listening on http://localhost:${PORT}`);
});
