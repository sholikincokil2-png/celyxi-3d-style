export const FPS = 30;
export const TOTAL_FRAMES = 1132; // 37.72s @ 30fps

export type CameraMode =
  | "zoom_in"
  | "snap_push_in"
  | "lateral_left_to_right"
  | "reveal_pull_back"
  | "shake_zoom"
  | "dolly_zoom_vertigo"
  | "slow_zoom_out"
  | "lateral_right_to_left"
  | "celebration_pull_back";

export interface SceneDef {
  id: number;
  startFrame: number;
  durationInFrames: number;
  cameraMode: CameraMode;
  title: string;
}

export const SCENES: SceneDef[] = [
  { id: 1, startFrame: 0, durationInFrames: 80, cameraMode: "zoom_in", title: "Tidur 8 Jam" },
  { id: 2, startFrame: 80, durationInFrames: 132, cameraMode: "snap_push_in", title: "Badan Remuk & Lemas" },
  { id: 3, startFrame: 212, durationInFrames: 111, cameraMode: "lateral_left_to_right", title: "Bukan Durasi Tidur" },
  { id: 4, startFrame: 323, durationInFrames: 91, cameraMode: "reveal_pull_back", title: "Fase Tidur Terpotong" },
  { id: 5, startFrame: 414, durationInFrames: 134, cameraMode: "shake_zoom", title: "Alarm Saat Deep Sleep" },
  { id: 6, startFrame: 548, durationInFrames: 114, cameraMode: "dolly_zoom_vertigo", title: "Otak Dipaksa Bangun" },
  { id: 7, startFrame: 662, durationInFrames: 99, cameraMode: "slow_zoom_out", title: "Sleep Inertia" },
  { id: 8, startFrame: 761, durationInFrames: 163, cameraMode: "lateral_right_to_left", title: "Kelipatan 90 Menit" },
  { id: 9, startFrame: 924, durationInFrames: 208, cameraMode: "celebration_pull_back", title: "Tubuh Jauh Lebih Segar" },
];

export interface CaptionBurst {
  text: string;
  startFrame: number;
  endFrame: number;
}

interface RawClause {
  startSec: number;
  endSec: number;
  chunks: string[];
}

const RAW_CLAUSES: RawClause[] = [
  { startSec: 0.08, endSec: 2.60, chunks: ["Pernah nggak", "kamu tidur", "8 jam,"] },
  { startSec: 2.75, endSec: 4.70, chunks: ["tapi pas", "bangun"] },
  { startSec: 4.70, endSec: 7.00, chunks: ["badan rasanya", "malah remuk", "makin lemas?"] },
  { startSec: 7.45, endSec: 9.50, chunks: ["Masalahnya", "seringkali"] },
  { startSec: 9.50, endSec: 10.70, chunks: ["bukan di", "durasi tidur"] },
  { startSec: 10.95, endSec: 12.50, chunks: ["melainkan", "fase tidur"] },
  { startSec: 12.50, endSec: 13.75, chunks: ["yang", "terpotong!"] },
  { startSec: 14.10, endSec: 15.95, chunks: ["Ketika alarm", "berbunyi"] },
  { startSec: 15.95, endSec: 18.20, chunks: ["saat kamu", "masih di fase", "DEEP SLEEP,"] },
  { startSec: 18.50, endSec: 20.30, chunks: ["otak kamu", "dipaksa bangun"] },
  { startSec: 20.30, endSec: 22.00, chunks: ["sebelum siklus", "SELESAI."] },
  { startSec: 22.35, endSec: 24.25, chunks: ["Fenomena ini", "disebut"] },
  { startSec: 24.25, endSec: 25.30, chunks: ["SLEEP INERTIA."] },
  { startSec: 25.65, endSec: 28.00, chunks: ["Solusi sederhana,", "coba atur"] },
  { startSec: 28.00, endSec: 30.75, chunks: ["waktu tidurmu", "kelipatan", "90 MENIT."] },
  { startSec: 31.00, endSec: 33.90, chunks: ["Misalnya 6 jam", "atau 7.5 jam."] },
  { startSec: 34.50, endSec: 36.30, chunks: ["Tubuhmu", "akan terasa"] },
  { startSec: 36.30, endSec: 37.65, chunks: ["jauh lebih", "SEGAR!"] },
];

export const CAPTION_BURSTS: CaptionBurst[] = (() => {
  const bursts: CaptionBurst[] = [];
  for (const cl of RAW_CLAUSES) {
    const totalWeight = cl.chunks.reduce((acc, ch) => acc + Math.max(2, ch.length), 0);
    let cur = cl.startSec;
    const span = cl.endSec - cl.startSec;
    for (const ch of cl.chunks) {
      const w = Math.max(2, ch.length);
      const dur = span * (w / totalWeight);
      bursts.push({
        text: ch,
        startFrame: Math.round(cur * FPS),
        endFrame: Math.round((cur + dur) * FPS),
      });
      cur += dur;
    }
  }
  return bursts;
})();
