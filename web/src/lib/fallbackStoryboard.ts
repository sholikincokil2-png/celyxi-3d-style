import type {
  BeatSpec,
  CharacterRole,
  EnvironmentTheme,
  RelicType,
  Storyboard,
  StoryboardRequest,
} from '../types/storyboard';

export interface IdeaPreset {
  id: string;
  label: string;
  badge: string;
  request: StoryboardRequest;
}

export const THEME_OPTIONS: Array<{
  value: EnvironmentTheme;
  label: string;
  tagline: string;
}> = [
  {
    value: 'frontier_town',
    label: 'Frontier Town',
    tagline: 'Dusty boardwalk, saloon facades & sunlit haze',
  },
  {
    value: 'courthouse',
    label: 'Courthouse Assay',
    tagline: 'Mahogany counter, crimson runner & arched sun shafts',
  },
  {
    value: 'space_station',
    label: 'Space Station',
    tagline: 'Orbital deck, starfield viewport & cyan hull rim',
  },
  {
    value: 'neon_alley',
    label: 'Neon Alley',
    tagline: 'Rain-slick cobblestones, glowing signage & cyber fog',
  },
  {
    value: 'cozy_studio',
    label: 'Cozy Studio',
    tagline: 'Warm timber loft, desk lamp & golden dust motes',
  },
];

export const ROLE_OPTIONS: Array<{
  value: CharacterRole;
  label: string;
  props: string;
}> = [
  { value: 'sheriff', label: 'Sheriff', props: 'Stetson, X-scar, red kerchief, gold star' },
  { value: 'clerk', label: 'Clerk', props: 'Emerald visor, round glasses, vest, stubble' },
  { value: 'astronaut', label: 'Astronaut', props: 'Bubble visor helmet, comms pack, suit patch' },
  { value: 'judge', label: 'Judge', props: 'Powdered wing wig, crimson collar, brass seal' },
  { value: 'explorer', label: 'Explorer', props: 'Pith safari hat, leather strap, brass compass' },
];

export const RELIC_OPTIONS: Array<{
  value: RelicType;
  label: string;
  color: string;
}> = [
  { value: 'golden_bell', label: 'Golden Relic Bell', color: '#FFD466' },
  { value: 'crystal_orb', label: 'Radiant Crystal Orb', color: '#8BE0FF' },
  { value: 'crown', label: 'Imperial Gold Crown', color: '#FFB84D' },
  { value: 'briefcase', label: 'Glowing Secret Briefcase', color: '#58F2C6' },
];

export const IDEA_PRESETS: IdeaPreset[] = [
  {
    id: 'sheriff-bell',
    label: "Sheriff's Golden Relic",
    badge: 'Classic @Celyxi',
    request: {
      idea: 'A swaggering frontier sheriff spots a WANTED poster, catches a nervous clerk hiding a glowing golden bell under the counter, puts him under a dramatic spotlight interrogation, and pops the relic open in golden bloom.',
      theme: 'frontier_town',
      heroRole: 'sheriff',
      sidekickRole: 'clerk',
      relicType: 'golden_bell',
      outlineThickness: 0.022,
      rimIntensity: 1.15,
      bloomStrength: 0.65,
      chiaroscuroBeat3: true,
    },
  },
  {
    id: 'space-orb',
    label: 'Orbital Crystal Smuggler',
    badge: 'Sci-Fi Comedy',
    request: {
      idea: 'An astronaut struts down the orbital corridor past a RESTRICTED airlock sign, catches a panicking explorer polishing a glowing crystal orb, interrogates him in dark emergency lighting, and laughs as the orb levitates.',
      theme: 'space_station',
      heroRole: 'astronaut',
      sidekickRole: 'explorer',
      relicType: 'crystal_orb',
      outlineThickness: 0.022,
      rimIntensity: 1.35,
      bloomStrength: 0.85,
      chiaroscuroBeat3: true,
    },
  },
  {
    id: 'judge-crown',
    label: 'The Verdict Crown',
    badge: 'Courtroom',
    request: {
      idea: 'A stern judge marches into the grand courthouse, spots a clerk trying to conceal a stolen imperial crown behind the bench, drops the room into chiaroscuro spotlight cross-examination, and bursts out laughing when the crown floats.',
      theme: 'courthouse',
      heroRole: 'judge',
      sidekickRole: 'clerk',
      relicType: 'crown',
      outlineThickness: 0.024,
      rimIntensity: 1.1,
      bloomStrength: 0.6,
      chiaroscuroBeat3: true,
    },
  },
  {
    id: 'neon-briefcase',
    label: 'Midnight Briefcase Deal',
    badge: 'Cyber Noir',
    request: {
      idea: 'An explorer tracks a glowing secret briefcase down a moody neon alley, corners a sweaty clerk behind a street kiosk, flashes a badge under a harsh alley spotlight, and celebrates as the briefcase erupts in cyan bloom.',
      theme: 'neon_alley',
      heroRole: 'explorer',
      sidekickRole: 'clerk',
      relicType: 'briefcase',
      outlineThickness: 0.023,
      rimIntensity: 1.45,
      bloomStrength: 0.9,
      chiaroscuroBeat3: true,
    },
  },
  {
    id: 'studio-bell',
    label: 'Late-Night Studio Secret',
    badge: 'Cozy',
    request: {
      idea: 'A sheriff visits a cozy animator studio after hours, finds the clerk guarding a mysterious golden bell on the workbench, runs a dramatic lamp-lit interrogation, and laughs when the bell unlocks golden sparkles.',
      theme: 'cozy_studio',
      heroRole: 'sheriff',
      sidekickRole: 'clerk',
      relicType: 'golden_bell',
      outlineThickness: 0.021,
      rimIntensity: 1.05,
      bloomStrength: 0.55,
      chiaroscuroBeat3: true,
    },
  },
];

const THEME_PALETTES: Record<EnvironmentTheme, Storyboard['palette']> = {
  frontier_town: {
    skyTop: '#283A59',
    skyHorizon: '#C99D62',
    keyLight: '#FFE4B8',
    fillLight: '#6E8FBD',
    rimLight: '#FFF0C4',
    relicGlow: '#FFD466',
    accent: '#B32622',
  },
  courthouse: {
    skyTop: '#243048',
    skyHorizon: '#D4A874',
    keyLight: '#FFE7C2',
    fillLight: '#6E8FBD',
    rimLight: '#FFDFA8',
    relicGlow: '#FFD466',
    accent: '#B32622',
  },
  space_station: {
    skyTop: '#0B1020',
    skyHorizon: '#1F3559',
    keyLight: '#D8EEFF',
    fillLight: '#3C649E',
    rimLight: '#8BE0FF',
    relicGlow: '#58F2C6',
    accent: '#3FA7D6',
  },
  neon_alley: {
    skyTop: '#0E0B1C',
    skyHorizon: '#2D1D47',
    keyLight: '#FFD6B0',
    fillLight: '#4F5D9E',
    rimLight: '#7DA0FF',
    relicGlow: '#58F2C6',
    accent: '#FF5B8C',
  },
  cozy_studio: {
    skyTop: '#251E24',
    skyHorizon: '#8E6242',
    keyLight: '#FFE0B0',
    fillLight: '#6D7BA3',
    rimLight: '#FFE9C2',
    relicGlow: '#FFD466',
    accent: '#D97B38',
  },
};

function deriveClueWord(idea: string, theme: EnvironmentTheme): string {
  const lower = idea.toLowerCase();
  if (lower.includes('wanted') || theme === 'frontier_town') return 'WANTED';
  if (lower.includes('restricted') || lower.includes('airlock') || theme === 'space_station') {
    return 'RESTRICTED';
  }
  if (lower.includes('evidence') || theme === 'courthouse') return 'EVIDENCE';
  if (lower.includes('secret') || theme === 'cozy_studio') return 'TOP SECRET';
  if (theme === 'neon_alley') return 'CAUTION';
  return 'NOTICE';
}

function deriveTitle(idea: string, heroRole: CharacterRole, relicType: RelicType): string {
  const trimmed = idea.trim();
  if (!trimmed) {
    return `The ${capitalize(heroRole)}'s ${capitalize(relicType.replace('_', ' '))}`;
  }
  const firstClause = trimmed.split(/[.,!?\n]/)[0].trim();
  if (firstClause.length <= 44) return firstClause;
  return `${firstClause.slice(0, 41).trim()}...`;
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function buildLocalStoryboard(req: StoryboardRequest): Storyboard {
  const palette = { ...THEME_PALETTES[req.theme] };
  const relicOption = RELIC_OPTIONS.find((r) => r.value === req.relicType);
  if (relicOption) {
    palette.relicGlow = relicOption.color;
  }

  const clueText = deriveClueWord(req.idea, req.theme);
  const heroName = capitalize(req.heroRole);
  const sidekickName = capitalize(req.sidekickRole);
  const relicName = relicOption?.label ?? capitalize(req.relicType.replace('_', ' '));
  const title = deriveTitle(req.idea, req.heroRole, req.relicType);

  const beats: [BeatSpec, BeatSpec, BeatSpec, BeatSpec] = [
    {
      id: 1,
      name: 'Establishing Swagger & Clue',
      label: 'Beat 1',
      startFrame: 1,
      endFrame: 75,
      setting: 'exterior',
      mood: 'Confident investigation',
      visualSummary: `${heroName} struts past the ${clueText} post, snaps to attention, and points toward the counter.`,
      cameraMotion: 'dolly_push_in',
      lensStartMm: 35,
      lensEndMm: 44,
      chiaroscuro: false,
      sweatActive: false,
      relicBloom: false,
      hero: {
        expression: 'neutral',
        expressionLate: 'suspicious',
        action: 'strut_walk',
        sweatDrops: 0,
      },
      sidekick: { expression: 'neutral', action: 'scrub_relic', sweatDrops: 0 },
      relicState: 'hidden',
      clueText,
    },
    {
      id: 2,
      name: 'Confrontation & Concealed Relic',
      label: 'Beat 2',
      startFrame: 76,
      endFrame: 150,
      setting: 'interior',
      mood: 'Growing suspicion & panic',
      visualSummary: `${sidekickName} furiously buffs the ${relicName}, then ducks trembling as ${heroName} slams the counter.`,
      cameraMotion: 'snap_cut_push',
      lensStartMm: 40,
      lensEndMm: 52,
      chiaroscuro: false,
      sweatActive: true,
      relicBloom: false,
      hero: {
        expression: 'suspicious',
        expressionLate: 'suspicious',
        action: 'lean_confront',
        sweatDrops: 0,
      },
      sidekick: {
        expression: 'shocked',
        expressionLate: 'panic',
        action: 'duck_tremble',
        sweatDrops: 3,
      },
      relicState: 'counter',
      clueText,
    },
    {
      id: 3,
      name: req.chiaroscuroBeat3 ? 'Chiaroscuro Spotlight Interrogation' : 'Close-Up Interrogation',
      label: 'Beat 3',
      startFrame: 151,
      endFrame: 225,
      setting: 'chiaroscuro',
      mood: 'Comedic noir tension',
      visualSummary: `${heroName} flashes a gleaming badge in tight spotlight; ${sidekickName} waves both stick arms in frantic denial.`,
      cameraMotion: 'low_angle_chiaroscuro',
      lensStartMm: 45,
      lensEndMm: 58,
      chiaroscuro: req.chiaroscuroBeat3,
      sweatActive: true,
      relicBloom: false,
      hero: { expression: 'suspicious', action: 'badge_raise', sweatDrops: 0 },
      sidekick: {
        expression: 'panic',
        expressionLate: 'blink',
        action: 'frantic_wave',
        sweatDrops: 4,
      },
      relicState: 'concealed',
      clueText,
    },
    {
      id: 4,
      name: 'Glowing Bloom Reveal & Smug Payoff',
      label: 'Beat 4',
      startFrame: 226,
      endFrame: 300,
      setting: 'payoff',
      mood: 'Triumphant golden bloom',
      visualSummary: `${relicName} erupts upward spinning in bright bloom; ${sidekickName} recoils while ${heroName} bursts out laughing.`,
      cameraMotion: 'snap_pull_back',
      lensStartMm: 55,
      lensEndMm: 32,
      chiaroscuro: false,
      sweatActive: false,
      relicBloom: true,
      hero: { expression: 'smug', action: 'smug_laugh', sweatDrops: 0 },
      sidekick: {
        expression: 'shocked',
        expressionLate: 'blink',
        action: 'recoil_fall',
        sweatDrops: 0,
      },
      relicState: 'rising_bloom',
      clueText,
    },
  ];

  // Blender 5.1 generate_from_idea.py exact JSON schema
  const blenderCompatiblePayload = {
    version: '1.0',
    title,
    idea: req.idea,
    durationSeconds: 10,
    fps: 30,
    totalFrames: 300,
    theme: req.theme,
    heroRole: req.heroRole,
    sidekickRole: req.sidekickRole,
    relicType: req.relicType,
    style: {
      outlineThickness: req.outlineThickness,
      rimIntensity: Number((req.rimIntensity * 0.4).toFixed(2)),
      bloomStrength: Number((req.bloomStrength * 0.6).toFixed(2)),
      chiaroscuroBeat3: req.chiaroscuroBeat3,
      accentColor: palette.relicGlow,
      secondaryColor: palette.accent,
    },
    beats: [
      {
        id: 1,
        name: beats[0].name,
        frameStart: 1,
        frameEnd: 75,
        setting: 'exterior',
        heroExpr: 'neutral',
        heroExprLate: 'suspicious',
        sidekickExpr: 'neutral',
        sweatActive: false,
        chiaroscuro: false,
        relicBloom: false,
        signText: clueText,
      },
      {
        id: 2,
        name: beats[1].name,
        frameStart: 76,
        frameEnd: 150,
        setting: 'interior',
        heroExpr: 'suspicious',
        heroExprLate: 'suspicious',
        sidekickExpr: 'shocked',
        sidekickExprLate: 'panic',
        sweatActive: true,
        chiaroscuro: false,
        relicBloom: false,
      },
      {
        id: 3,
        name: beats[2].name,
        frameStart: 151,
        frameEnd: 225,
        setting: 'interior',
        heroExpr: 'suspicious',
        sidekickExpr: 'panic',
        sidekickExprLate: 'blink',
        sweatActive: true,
        chiaroscuro: req.chiaroscuroBeat3,
        relicBloom: false,
      },
      {
        id: 4,
        name: beats[3].name,
        frameStart: 226,
        frameEnd: 300,
        setting: 'interior',
        heroExpr: 'smug',
        sidekickExpr: 'shocked',
        sidekickExprLate: 'blink',
        sweatActive: false,
        chiaroscuro: false,
        relicBloom: true,
      },
    ],
  };

  return {
    version: '1.0',
    id: `local-${Date.now().toString(36)}`,
    title,
    idea: req.idea,
    fps: 30,
    totalFrames: 300,
    durationSec: 10,
    resolution: { width: 1080, height: 1920 },
    theme: req.theme,
    heroRole: req.heroRole,
    sidekickRole: req.sidekickRole,
    relicType: req.relicType,
    shaders: {
      outlineThickness: req.outlineThickness,
      rimIntensity: req.rimIntensity,
      bloomStrength: req.bloomStrength,
      chiaroscuroBeat3: req.chiaroscuroBeat3,
    },
    palette,
    beats,
    source: 'local-fallback',
    rawBackendPayload: blenderCompatiblePayload,
  };
}
