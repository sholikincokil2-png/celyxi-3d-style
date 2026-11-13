/**
 * Deterministic Idea-to-Storyboard engine for Celyxi 3D Video Studio.
 * Output schema aligns 1:1 with `blender_pipeline/generate_from_idea.py`.
 */

export const TOTAL_FRAMES = 300;
export const FPS = 30;
export const DURATION_SECONDS = 10;

export const THEMES = [
  "frontier_town",
  "courthouse",
  "space_station",
  "neon_alley",
  "cozy_studio",
];

export const ROLES = ["sheriff", "clerk", "astronaut", "judge", "explorer"];

export const RELIC_TYPES = ["golden_bell", "crystal_orb", "crown", "briefcase"];

export const EXPRESSIONS = ["neutral", "suspicious", "shocked", "panic", "smug", "blink"];

const THEME_DEFAULTS = {
  frontier_town: {
    label: "Frontier Town",
    accentColor: "#E6B333",
    secondaryColor: "#B32622",
    signDefault: "WANTED",
  },
  courthouse: {
    label: "Grand Courthouse",
    accentColor: "#E6B333",
    secondaryColor: "#B32622",
    signDefault: "ORDER",
  },
  space_station: {
    label: "Space Station",
    accentColor: "#22D3EE",
    secondaryColor: "#F59E0B",
    signDefault: "CARGO ALERT",
  },
  neon_alley: {
    label: "Neon Alley",
    accentColor: "#FF3D8B",
    secondaryColor: "#38BDF8",
    signDefault: "NO ENTRY",
  },
  cozy_studio: {
    label: "Cozy Studio",
    accentColor: "#F59E0B",
    secondaryColor: "#3B8C75",
    signDefault: "ON AIR",
  },
};

const ROLE_LABELS = {
  sheriff: "Sheriff",
  clerk: "Clerk",
  astronaut: "Astronaut",
  judge: "Judge",
  explorer: "Explorer",
};

const RELIC_LABELS = {
  golden_bell: "Golden Bell",
  crystal_orb: "Crystal Orb",
  crown: "Imperial Crown",
  briefcase: "Vault Briefcase",
};

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function pickFrom(arr, value, fallback) {
  return arr.includes(value) ? value : fallback;
}

function isHexColor(val) {
  return typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val.trim());
}

function extractSignKeyword(idea, fallback) {
  const stops = new Set([
    "about", "after", "again", "around", "because", "before", "behind", "between",
    "could", "every", "first", "found", "their", "there", "these", "thing", "think",
    "those", "through", "under", "until", "where", "which", "while", "with", "would",
    "catches", "hiding", "glowing", "inspects", "smuggling", "aboard", "suspicious",
    "nervous", "golden", "crystal", "sheriff", "clerk", "astronaut", "judge", "explorer",
  ]);
  const words = idea
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stops.has(w));
  if (words.length === 0) return fallback;
  return words[0].toUpperCase().slice(0, 12);
}

function inferThemeFromIdea(idea, requested) {
  if (THEMES.includes(requested)) return requested;
  const lower = idea.toLowerCase();
  if (/(space|orbit|rocket|alien|station|mars|moon|laser|airlock)/.test(lower)) return "space_station";
  if (/(court|judge|trial|gavel|lawyer|verdict|jury)/.test(lower)) return "courthouse";
  if (/(neon|cyber|alley|hacker|city|robot|rain)/.test(lower)) return "neon_alley";
  if (/(studio|desk|coffee|podcast|coding|office|book)/.test(lower)) return "cozy_studio";
  return "frontier_town";
}

function inferRelicFromIdea(idea, requested) {
  if (RELIC_TYPES.includes(requested)) return requested;
  const lower = idea.toLowerCase();
  if (/(orb|crystal|gem|sphere|core)/.test(lower)) return "crystal_orb";
  if (/(crown|king|royal|tiara)/.test(lower)) return "crown";
  if (/(case|briefcase|vault|secret|document|file)/.test(lower)) return "briefcase";
  return "golden_bell";
}

function buildTitle(idea, heroRole, relicType) {
  const cleaned = idea.replace(/[.!?]+$/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && words.length <= 7) {
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return `${ROLE_LABELS[heroRole]} & The ${RELIC_LABELS[relicType]}`;
}

/**
 * Deterministically builds a 4-beat, 300-frame @Celyxi storyboard JSON
 * matching `blender_pipeline/generate_from_idea.py`.
 *
 * @param {Record<string, unknown>} input
 */
export function generateStoryboard(input = {}) {
  const rawIdea =
    typeof input.idea === "string" && input.idea.trim()
      ? input.idea.trim()
      : "A suspicious sheriff confronts a nervous clerk hiding a glowing golden bell behind the counter.";

  const theme = inferThemeFromIdea(rawIdea, input.theme);
  const heroRole = pickFrom(ROLES, input.heroRole, "sheriff");
  const sidekickRole = pickFrom(
    ROLES,
    input.sidekickRole,
    heroRole === "clerk" ? "sheriff" : "clerk",
  );
  const relicType = inferRelicFromIdea(rawIdea, input.relicType);

  const themePreset = THEME_DEFAULTS[theme];
  const outlineThickness = Number(
    clamp(Number(input.outlineThickness ?? 0.022), 0.008, 0.045).toFixed(4),
  );
  const rimIntensity = Number(
    clamp(Number(input.rimIntensity ?? 0.42), 0.05, 1.5).toFixed(3),
  );
  const bloomStrength = Number(
    clamp(Number(input.bloomStrength ?? 0.36), 0.0, 1.2).toFixed(3),
  );
  const chiaroscuroBeat3 = input.chiaroscuroBeat3 !== false;

  const accentColor = isHexColor(input.accentColor)
    ? input.accentColor.trim()
    : themePreset.accentColor;
  const secondaryColor = isHexColor(input.secondaryColor)
    ? input.secondaryColor.trim()
    : themePreset.secondaryColor;

  const seed = hashString(
    `${rawIdea}|${theme}|${heroRole}|${sidekickRole}|${relicType}|${outlineThickness}|${rimIntensity}|${bloomStrength}|${chiaroscuroBeat3}`,
  );
  const rng = createRng(seed);

  const signText =
    typeof input.signText === "string" && input.signText.trim()
      ? input.signText.trim().toUpperCase().slice(0, 14)
      : rng() > 0.45
        ? extractSignKeyword(rawIdea, themePreset.signDefault)
        : themePreset.signDefault;

  const beat1Names = {
    frontier_town: "Main Street Clue",
    courthouse: "Hallway Inspection",
    space_station: "Airlock Patrol",
    neon_alley: "Rainy Alley Scan",
    cozy_studio: "Studio Check-In",
  };
  const beat2Names = {
    frontier_town: "Counter Cover-Up",
    courthouse: "Bench Confrontation",
    space_station: "Console Check",
    neon_alley: "Booth Standoff",
    cozy_studio: "Desk Discovery",
  };

  const relicLabel = RELIC_LABELS[relicType];
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : buildTitle(rawIdea, heroRole, relicType);

  return {
    version: "1.0",
    title,
    idea: rawIdea,
    durationSeconds: DURATION_SECONDS,
    fps: FPS,
    totalFrames: TOTAL_FRAMES,
    theme,
    heroRole,
    sidekickRole,
    relicType,
    style: {
      outlineThickness,
      rimIntensity,
      bloomStrength,
      chiaroscuroBeat3,
      accentColor,
      secondaryColor,
    },
    beats: [
      {
        id: 1,
        name: beat1Names[theme] || "The Clue",
        frameStart: 1,
        frameEnd: 75,
        setting: "exterior",
        heroExpr: "neutral",
        heroExprLate: "suspicious",
        sidekickExpr: "neutral",
        sweatActive: false,
        chiaroscuro: false,
        relicBloom: false,
        signText,
      },
      {
        id: 2,
        name: beat2Names[theme] || "Counter Confrontation",
        frameStart: 76,
        frameEnd: 150,
        setting: "interior",
        heroExpr: "suspicious",
        heroExprLate: "suspicious",
        sidekickExpr: "shocked",
        sidekickExprLate: "panic",
        sweatActive: true,
        chiaroscuro: false,
        relicBloom: false,
      },
      {
        id: 3,
        name: "Spotlight Interrogation",
        frameStart: 151,
        frameEnd: 225,
        setting: "interior",
        heroExpr: "suspicious",
        sidekickExpr: "panic",
        sidekickExprLate: "blink",
        sweatActive: true,
        chiaroscuro: chiaroscuroBeat3,
        relicBloom: false,
      },
      {
        id: 4,
        name: `${relicLabel} Bloom Reveal`,
        frameStart: 226,
        frameEnd: 300,
        setting: "interior",
        heroExpr: "smug",
        sidekickExpr: "shocked",
        sidekickExprLate: "blink",
        sweatActive: false,
        chiaroscuro: false,
        relicBloom: true,
      },
    ],
  };
}

/**
 * Validates and normalizes either a full storyboard payload or a flat request object
 * into a schema-compliant storyboard JSON for Blender & Three.js.
 *
 * @param {Record<string, unknown>} payload
 */
export function normalizeStoryboard(payload) {
  if (!payload || typeof payload !== "object") {
    return generateStoryboard({});
  }

  const styleObj = payload.style && typeof payload.style === "object" ? payload.style : {};
  const base = generateStoryboard({
    title: payload.title,
    idea: payload.idea,
    theme: payload.theme,
    heroRole: payload.heroRole,
    sidekickRole: payload.sidekickRole,
    relicType: payload.relicType,
    outlineThickness: styleObj.outlineThickness ?? payload.outlineThickness,
    rimIntensity: styleObj.rimIntensity ?? payload.rimIntensity,
    bloomStrength: styleObj.bloomStrength ?? payload.bloomStrength,
    chiaroscuroBeat3: styleObj.chiaroscuroBeat3 ?? payload.chiaroscuroBeat3,
    accentColor: styleObj.accentColor ?? payload.accentColor,
    secondaryColor: styleObj.secondaryColor ?? payload.secondaryColor,
  });

  if (Array.isArray(payload.beats) && payload.beats.length >= 4) {
    base.beats = base.beats.map((defaultBeat, idx) => {
      const incoming = payload.beats[idx];
      if (!incoming || typeof incoming !== "object") return defaultBeat;
      const merged = { ...defaultBeat, ...incoming };
      merged.id = idx + 1;
      merged.frameStart = defaultBeat.frameStart;
      merged.frameEnd = defaultBeat.frameEnd;
      return merged;
    });
  }

  return base;
}
