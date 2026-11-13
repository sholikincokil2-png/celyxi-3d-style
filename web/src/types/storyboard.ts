export type EnvironmentTheme =
  | 'frontier_town'
  | 'courthouse'
  | 'space_station'
  | 'neon_alley'
  | 'cozy_studio';

export type CharacterRole =
  | 'sheriff'
  | 'clerk'
  | 'astronaut'
  | 'judge'
  | 'explorer';

export type RelicType =
  | 'golden_bell'
  | 'crystal_orb'
  | 'crown'
  | 'briefcase';

export type FaceExpression =
  | 'neutral'
  | 'suspicious'
  | 'shocked'
  | 'panic'
  | 'smug'
  | 'blink';

export type CameraMotionType =
  | 'dolly_push_in'
  | 'snap_cut_push'
  | 'low_angle_chiaroscuro'
  | 'snap_pull_back'
  | 'lateral_truck'
  | 'vertigo_zoom';

export interface CelyxiShaderSettings {
  outlineThickness: number;
  rimIntensity: number;
  bloomStrength: number;
  chiaroscuroBeat3: boolean;
}

export interface StoryboardRequest {
  idea: string;
  theme: EnvironmentTheme;
  heroRole: CharacterRole;
  sidekickRole: CharacterRole;
  relicType: RelicType;
  outlineThickness: number;
  rimIntensity: number;
  bloomStrength: number;
  chiaroscuroBeat3: boolean;
}

export interface BeatCharacterDirective {
  expression: FaceExpression;
  expressionLate?: FaceExpression;
  action:
    | 'strut_walk'
    | 'point_clue'
    | 'scrub_relic'
    | 'lean_confront'
    | 'duck_tremble'
    | 'badge_raise'
    | 'frantic_wave'
    | 'recoil_fall'
    | 'smug_laugh'
    | 'peek_blink';
  sweatDrops?: number;
}

export interface BeatSpec {
  id: 1 | 2 | 3 | 4;
  name: string;
  label: string;
  startFrame: number;
  endFrame: number;
  setting: 'exterior' | 'interior' | 'chiaroscuro' | 'payoff';
  mood: string;
  visualSummary: string;
  cameraMotion: CameraMotionType;
  lensStartMm: number;
  lensEndMm: number;
  chiaroscuro: boolean;
  sweatActive: boolean;
  relicBloom: boolean;
  hero: BeatCharacterDirective;
  sidekick: BeatCharacterDirective;
  relicState: 'hidden' | 'counter' | 'concealed' | 'rising_bloom';
  clueText: string;
}

export interface Storyboard {
  version: string;
  id: string;
  title: string;
  idea: string;
  fps: 30;
  totalFrames: 300;
  durationSec: 10;
  resolution: { width: 1080; height: 1920 };
  theme: EnvironmentTheme;
  heroRole: CharacterRole;
  sidekickRole: CharacterRole;
  relicType: RelicType;
  shaders: CelyxiShaderSettings;
  palette: {
    skyTop: string;
    skyHorizon: string;
    keyLight: string;
    fillLight: string;
    rimLight: string;
    relicGlow: string;
    accent: string;
  };
  beats: [BeatSpec, BeatSpec, BeatSpec, BeatSpec];
  source?: 'backend' | 'local-fallback';
  rawBackendPayload?: unknown;
}

export interface HealthStatus {
  ok: boolean;
  blender?: { available: boolean; version?: string; path?: string };
  ffmpeg?: { available: boolean; version?: string };
  showcaseAvailable?: boolean;
  message?: string;
}

export interface RenderJobStatus {
  jobId: string;
  status:
    | 'queued'
    | 'rendering'
    | 'rendering_3d'
    | 'encoding'
    | 'encoding_video'
    | 'completed'
    | 'failed';
  phase?: string;
  progress: number;
  framesRendered: number;
  totalFrames: number;
  videoUrl?: string;
  error?: string;
  logs?: string[];
}
