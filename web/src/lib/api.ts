import type {
  BeatSpec,
  CharacterRole,
  EnvironmentTheme,
  FaceExpression,
  HealthStatus,
  RelicType,
  RenderJobStatus,
  Storyboard,
  StoryboardRequest,
} from '../types/storyboard';
import { buildLocalStoryboard } from './fallbackStoryboard';

const VALID_THEMES = new Set<EnvironmentTheme>([
  'frontier_town',
  'courthouse',
  'space_station',
  'neon_alley',
  'cozy_studio',
]);

const VALID_ROLES = new Set<CharacterRole>([
  'sheriff',
  'clerk',
  'astronaut',
  'judge',
  'explorer',
]);

const VALID_RELICS = new Set<RelicType>([
  'golden_bell',
  'crystal_orb',
  'crown',
  'briefcase',
]);

const VALID_EXPRESSIONS = new Set<FaceExpression>([
  'neutral',
  'suspicious',
  'shocked',
  'panic',
  'smug',
  'blink',
]);

function pickExpr(val: unknown, fallback: FaceExpression): FaceExpression {
  if (typeof val === 'string' && VALID_EXPRESSIONS.has(val as FaceExpression)) {
    return val as FaceExpression;
  }
  return fallback;
}

/**
 * Adapts @rig-shader / @web-backend storyboard JSON cleanly onto our typed Storyboard model
 * while preserving the raw backend payload for JSON export & Blender CLI rendering.
 */
export function normalizeBackendStoryboard(raw: unknown, req: StoryboardRequest): Storyboard {
  const base = buildLocalStoryboard(req);
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const obj = raw as Record<string, unknown>;
  const sb = (obj.storyboard && typeof obj.storyboard === 'object'
    ? (obj.storyboard as Record<string, unknown>)
    : obj) as Record<string, unknown>;

  const theme =
    typeof sb.theme === 'string' && VALID_THEMES.has(sb.theme as EnvironmentTheme)
      ? (sb.theme as EnvironmentTheme)
      : base.theme;

  const heroRole =
    typeof sb.heroRole === 'string' && VALID_ROLES.has(sb.heroRole as CharacterRole)
      ? (sb.heroRole as CharacterRole)
      : base.heroRole;

  const sidekickRole =
    typeof sb.sidekickRole === 'string' && VALID_ROLES.has(sb.sidekickRole as CharacterRole)
      ? (sb.sidekickRole as CharacterRole)
      : base.sidekickRole;

  const relicType =
    typeof sb.relicType === 'string' && VALID_RELICS.has(sb.relicType as RelicType)
      ? (sb.relicType as RelicType)
      : base.relicType;

  const styleObj = (sb.style as Record<string, unknown> | undefined) ?? {};
  const palette = {
    ...base.palette,
    relicGlow:
      typeof styleObj.accentColor === 'string' ? styleObj.accentColor : base.palette.relicGlow,
    accent:
      typeof styleObj.secondaryColor === 'string' ? styleObj.secondaryColor : base.palette.accent,
  };

  const rawBeats = Array.isArray(sb.beats) ? sb.beats : [];
  const mergedBeats = base.beats.map((defBeat, idx): BeatSpec => {
    const rb = rawBeats[idx] as Record<string, unknown> | undefined;
    if (!rb || typeof rb !== 'object') return defBeat;

    const startFrame =
      typeof rb.frameStart === 'number'
        ? rb.frameStart
        : typeof rb.startFrame === 'number'
          ? rb.startFrame
          : defBeat.startFrame;

    const endFrame =
      typeof rb.frameEnd === 'number'
        ? rb.frameEnd
        : typeof rb.endFrame === 'number'
          ? rb.endFrame
          : defBeat.endFrame;

    const sweatActive =
      typeof rb.sweatActive === 'boolean' ? rb.sweatActive : defBeat.sweatActive;

    return {
      ...defBeat,
      name: typeof rb.name === 'string' ? rb.name : defBeat.name,
      startFrame,
      endFrame,
      mood: typeof rb.mood === 'string' ? rb.mood : defBeat.mood,
      visualSummary:
        typeof rb.visualSummary === 'string'
          ? rb.visualSummary
          : typeof rb.summary === 'string'
            ? rb.summary
            : defBeat.visualSummary,
      chiaroscuro:
        typeof rb.chiaroscuro === 'boolean'
          ? rb.chiaroscuro
          : defBeat.id === 3
            ? req.chiaroscuroBeat3
            : defBeat.chiaroscuro,
      sweatActive,
      relicBloom: typeof rb.relicBloom === 'boolean' ? rb.relicBloom : defBeat.relicBloom,
      clueText:
        typeof rb.signText === 'string'
          ? rb.signText
          : typeof rb.clueText === 'string'
            ? rb.clueText
            : defBeat.clueText,
      hero: {
        ...defBeat.hero,
        expression: pickExpr(rb.heroExpr, defBeat.hero.expression),
        expressionLate: pickExpr(
          rb.heroExprLate,
          defBeat.hero.expressionLate ?? defBeat.hero.expression,
        ),
      },
      sidekick: {
        ...defBeat.sidekick,
        expression: pickExpr(rb.sidekickExpr, defBeat.sidekick.expression),
        expressionLate: pickExpr(
          rb.sidekickExprLate,
          defBeat.sidekick.expressionLate ?? defBeat.sidekick.expression,
        ),
        sweatDrops: sweatActive ? (defBeat.sidekick.sweatDrops ?? 3) : 0,
      },
    };
  }) as [BeatSpec, BeatSpec, BeatSpec, BeatSpec];

  return {
    ...base,
    id: typeof sb.id === 'string' ? sb.id : base.id,
    title: typeof sb.title === 'string' ? sb.title : base.title,
    theme,
    heroRole,
    sidekickRole,
    relicType,
    palette,
    beats: mergedBeats,
    source: 'backend',
    rawBackendPayload: sb,
  };
}

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const showcaseObj = data.showcase as { exists?: boolean } | undefined;
    return {
      ok: Boolean(data.ok ?? true),
      blender: data.blender as HealthStatus['blender'],
      ffmpeg: data.ffmpeg as HealthStatus['ffmpeg'],
      showcaseAvailable: Boolean(showcaseObj?.exists ?? data.showcaseAvailable ?? true),
      message: typeof data.message === 'string' ? data.message : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Backend offline (static preview mode)',
    };
  }
}

export async function generateStoryboard(req: StoryboardRequest): Promise<Storyboard> {
  try {
    const res = await fetch('/api/storyboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    return normalizeBackendStoryboard(json, req);
  } catch {
    return buildLocalStoryboard(req);
  }
}

export async function startBlenderRender(storyboard: Storyboard): Promise<RenderJobStatus> {
  const payload = storyboard.rawBackendPayload ?? storyboard;
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboard: payload }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to start Blender render (HTTP ${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return parseRenderJob(data);
}

export async function fetchRenderJob(jobId: string): Promise<RenderJobStatus> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return parseRenderJob(data);
}

function parseRenderJob(data: Record<string, unknown>): RenderJobStatus {
  const jobId = String(data.jobId ?? data.id ?? '');
  const totalFrames = Number(data.totalFrames ?? 300);
  const framesRendered = Number(
    data.renderedFrames ?? data.framesRendered ?? data.frames_rendered ?? 0,
  );
  const progress =
    typeof data.progress === 'number'
      ? data.progress
      : totalFrames > 0
        ? Math.min(100, Math.round((framesRendered / totalFrames) * 100))
        : 0;
  const status = (data.status as RenderJobStatus['status']) ?? 'queued';
  const videoUrl =
    typeof data.videoUrl === 'string'
      ? data.videoUrl
      : status === 'completed' && jobId
        ? `/api/jobs/${encodeURIComponent(jobId)}/video`
        : undefined;

  return {
    jobId,
    status,
    phase: typeof data.phase === 'string' ? data.phase : undefined,
    progress,
    framesRendered,
    totalFrames,
    videoUrl,
    error: typeof data.error === 'string' ? data.error : undefined,
    logs: Array.isArray(data.logsTail)
      ? (data.logsTail as string[])
      : Array.isArray(data.logs)
        ? (data.logs as string[])
        : undefined,
  };
}
