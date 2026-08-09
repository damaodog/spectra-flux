import {
  SMOKE_TIME_SCALE,
  hexToRgb,
  toShaderSeed,
  type CardConfig,
} from "../card-core.ts";
import { MOTION_STUDIES, type MotionStudy } from "../motion-catalog.ts";

export const LAB_MAX_LAYERS = 6;

export type MixIntensity = "soft" | "balanced" | "intense";
export type PaletteDirection =
  | "random"
  | "analogous"
  | "warm-cool"
  | "triadic"
  | "dominant-highlight"
  | "low-saturation-ink";
export type RecipePaletteDirection = Exclude<PaletteDirection, "random"> | "snapshot";
export type InteractionBias =
  | "random"
  | "free"
  | "blend"
  | "collision"
  | "weave"
  | "erode"
  | "light"
  | "difference";
export type RhythmDirection =
  | "random"
  | "wander"
  | "breath"
  | "alternating"
  | "pulse"
  | "flow";
export type CompositionDirection =
  | "random"
  | "automatic"
  | "horizontal"
  | "center-collision"
  | "pincer"
  | "vortex"
  | "interlace";
export type DensityDirection = "random" | "thin" | "standard" | "dense";
export type EdgeDirection = "random" | "soft" | "mixed" | "sharp";
export type ResolvedInteractionBias = Exclude<InteractionBias, "random">;
export type ResolvedRhythm = Exclude<RhythmDirection, "random">;
export type ResolvedComposition = Exclude<CompositionDirection, "random">;
export type ResolvedDensity = Exclude<DensityDirection, "random">;
export type ResolvedEdge = Exclude<EdgeDirection, "random">;

export type LabSettings = {
  effectCount: number;
  mixIntensity: MixIntensity;
  speedMin: number;
  speedMax: number;
  paletteDirection: PaletteDirection;
  interactionBias?: InteractionBias;
  rhythm?: RhythmDirection;
  composition?: CompositionDirection;
  density?: DensityDirection;
  edge?: EdgeDirection;
};

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  effectCount: 3,
  mixIntensity: "balanced",
  speedMin: 0.2,
  speedMax: 1.8,
  paletteDirection: "random",
};

export const INTERACTION_LABELS = {
  0: "融合",
  1: "碰撞",
  2: "交缠",
  3: "吞噬",
  4: "光叠",
  5: "差异切割",
} as const;

export type InteractionMode = keyof typeof INTERACTION_LABELS;

export type SpeedProfile = {
  min: number;
  max: number;
  wanderRate: number;
  surgeRate: number;
  surgeMix: number;
  seed: number;
};

export type LabLayer = {
  studyId: number;
  name: string;
  chapter: number;
  variant: number;
  kernel: number;
  params: readonly [number, number, number, number];
  seed: number;
  intensity: number;
  scale: number;
  angle: number;
  warp: number;
  weight: number;
  colorA: string;
  colorB: string;
  speed: SpeedProfile;
  offsetX: number;
  offsetY: number;
};

export type LabRecipe = {
  seed: number;
  effectCount: number;
  mixIntensity: MixIntensity;
  interactionStrength: number;
  paletteName: string;
  paletteDirection: RecipePaletteDirection;
  palette: string[];
  layers: LabLayer[];
  interactions: InteractionMode[];
  interactionBias: ResolvedInteractionBias;
  rhythm: ResolvedRhythm;
  composition: ResolvedComposition;
  density: ResolvedDensity;
  edge: ResolvedEdge;
  densityScale: number;
  edgeSharpness: number;
};

export type PackedLabRecipe = {
  interactionStrength: number;
  densityScale: number;
  edgeSharpness: number;
  variants: Int32Array;
  kernels: Int32Array;
  modes: Int32Array;
  seeds: Float32Array;
  intensities: Float32Array;
  params: Float32Array;
  colorsA: Float32Array;
  colorsB: Float32Array;
  transforms: Float32Array;
  offsets: Float32Array;
};

type Random = () => number;

const concretePaletteDirections = [
  "analogous",
  "warm-cool",
  "triadic",
  "dominant-highlight",
  "low-saturation-ink",
] as const;

const paletteNames: Record<RecipePaletteDirection, string> = {
  analogous: "邻近雾化",
  "warm-cool": "冷暖对撞",
  triadic: "三角色交缠",
  "dominant-highlight": "主色高光",
  "low-saturation-ink": "低饱和墨流",
  snapshot: "单效果快照",
};

const intensityRanges = {
  soft: { intensity: [0.34, 0.62], warp: [0.012, 0.04], strength: 0.72 },
  balanced: { intensity: [0.45, 0.95], warp: [0.025, 0.1], strength: 1 },
  intense: { intensity: [0.64, 1], warp: [0.055, 0.14], strength: 1.32 },
} as const;

const interactionBiasOptions = [
  "free",
  "blend",
  "collision",
  "weave",
  "erode",
  "light",
  "difference",
] as const;
const rhythmOptions = [
  "wander",
  "breath",
  "alternating",
  "pulse",
  "flow",
] as const;
const compositionOptions = [
  "automatic",
  "horizontal",
  "center-collision",
  "pincer",
  "vortex",
  "interlace",
] as const;
const densityOptions = ["thin", "standard", "dense"] as const;
const edgeOptions = ["soft", "mixed", "sharp"] as const;
const densityScales: Record<ResolvedDensity, number> = {
  thin: 0.72,
  standard: 1,
  dense: 1.42,
};
const edgeSharpnesses: Record<ResolvedEdge, number> = {
  soft: 0.68,
  mixed: 1,
  sharp: 1.55,
};
const rhythmSurgeMix: Record<ResolvedRhythm, number> = {
  wander: 0.18,
  breath: 0.32,
  alternating: 0.58,
  pulse: 0.72,
  flow: 0.1,
};

const LEGACY_RECIPE_DEFAULTS = {
  interactionBias: "free",
  rhythm: "wander",
  composition: "automatic",
  density: "standard",
  edge: "mixed",
  densityScale: 1,
  edgeSharpness: 1,
  offsetX: 0,
  offsetY: 0,
  surgeMix: 0.18,
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number) => value * value * (3 - 2 * value);

const seededRandom = (seed: number): Random => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const hashUnit = (seed: number, index: number) => {
  let value = Math.imul((seed ^ index) >>> 0, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};

const valueNoise = (seed: number, value: number) => {
  const index = Math.floor(value);
  const fraction = smoothstep(value - index);
  const a = hashUnit(seed, index);
  return a + (hashUnit(seed, index + 1) - a) * fraction;
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const middle = chroma * (1 - Math.abs((section % 2) - 1));
  const [r, g, b] =
    section < 1
      ? [chroma, middle, 0]
      : section < 2
        ? [middle, chroma, 0]
        : section < 3
          ? [0, chroma, middle]
          : section < 4
            ? [0, middle, chroma]
            : section < 5
              ? [middle, 0, chroma]
              : [chroma, 0, middle];
  const offset = l - chroma / 2;
  return `#${[r, g, b]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
};

const createPalette = (
  random: Random,
  effectCount: number,
  requested: PaletteDirection,
) => {
  const direction =
    requested === "random"
      ? concretePaletteDirections[
          Math.floor(random() * concretePaletteDirections.length)
        ]
      : requested;
  const count = clamp(Math.max(3, effectCount), 3, LAB_MAX_LAYERS);
  const baseHue = random() * 360;
  const colors = Array.from({ length: count }, (_, index) => {
    const centered = index - (count - 1) / 2;
    const jitter = (random() - 0.5) * 12;

    if (direction === "analogous") {
      return hslToHex(baseHue + centered * 24 + jitter, 68 + random() * 16, 67 + random() * 9);
    }
    if (direction === "warm-cool") {
      const warmHue = 8 + random() * 44;
      const coolHue = 190 + random() * 78;
      return hslToHex(index % 2 === 0 ? warmHue : coolHue, 72 + random() * 18, 62 + random() * 10);
    }
    if (direction === "triadic") {
      return hslToHex(baseHue + (index % 3) * 120 + jitter, 66 + random() * 20, 61 + random() * 12);
    }
    if (direction === "dominant-highlight") {
      const accent = index === count - 1;
      return hslToHex(baseHue + (accent ? 155 + jitter : centered * 10), accent ? 92 : 64, accent ? 66 : 71);
    }
    return hslToHex(baseHue + centered * 42 + jitter, index === 0 ? 38 : 78, index === 0 ? 76 : 62 + random() * 9);
  });

  return { direction, name: paletteNames[direction], colors };
};

const pickWeightedStudy = (
  random: Random,
  selected: MotionStudy[],
  studies: readonly MotionStudy[],
) => {
  const candidates = studies.filter(
    (candidate) => !selected.some(({ id }) => id === candidate.id),
  );
  const weights = candidates.map((candidate) => {
    const newChapter = selected.every(({ chapter }) => chapter !== candidate.chapter);
    const repeatedKernel = selected.some(({ kernel }) => kernel === candidate.kernel);
    return (newChapter ? 4 : 1) * (repeatedKernel ? 0.45 : 1);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;

  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
};

export function velocityAt(profile: SpeedProfile, elapsedSeconds: number) {
  const wander = valueNoise(profile.seed, elapsedSeconds * profile.wanderRate);
  const surgeNoise = valueNoise(
    profile.seed ^ 0x9e3779b9,
    elapsedSeconds * profile.surgeRate,
  );
  const surge = smoothstep(clamp((surgeNoise - 0.76) / 0.24, 0, 1));
  return (
    profile.min +
    (profile.max - profile.min) *
      clamp(
        wander * (1 - profile.surgeMix) + surge * profile.surgeMix,
        0,
        1,
      )
  );
}

export function advancePhaseTimes(
  recipe: LabRecipe,
  phaseTimes: Float32Array,
  elapsedSeconds: number,
  deltaSeconds: number,
) {
  const delta = clamp(deltaSeconds, 0, 0.05);
  recipe.layers.forEach((layer, index) => {
    phaseTimes[index] +=
      velocityAt(layer.speed, elapsedSeconds) * delta * SMOKE_TIME_SCALE;
  });
  return phaseTimes;
}

const normalizeRequestedOption = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T | "random" =>
  value === "random"
    ? "random"
    : typeof value === "string" && options.includes(value as T)
      ? (value as T)
      : fallback;

const normalizeSettings = (settings: LabSettings): Required<LabSettings> => {
  const lower = clamp(Math.min(settings.speedMin, settings.speedMax), 0.1, 2.5);
  const upper = clamp(Math.max(settings.speedMin, settings.speedMax), lower + 0.1, 2.6);
  return {
    effectCount: Math.trunc(clamp(settings.effectCount, 1, LAB_MAX_LAYERS)),
    mixIntensity: settings.mixIntensity in intensityRanges
      ? settings.mixIntensity
      : "balanced",
    speedMin: lower,
    speedMax: upper,
    paletteDirection:
      settings.paletteDirection === "random" ||
      concretePaletteDirections.includes(
        settings.paletteDirection as (typeof concretePaletteDirections)[number],
      )
        ? settings.paletteDirection
        : "random",
    interactionBias: normalizeRequestedOption(
      settings.interactionBias,
      interactionBiasOptions,
      LEGACY_RECIPE_DEFAULTS.interactionBias,
    ),
    rhythm: normalizeRequestedOption(
      settings.rhythm,
      rhythmOptions,
      LEGACY_RECIPE_DEFAULTS.rhythm,
    ),
    composition: normalizeRequestedOption(
      settings.composition,
      compositionOptions,
      LEGACY_RECIPE_DEFAULTS.composition,
    ),
    density: normalizeRequestedOption(
      settings.density,
      densityOptions,
      LEGACY_RECIPE_DEFAULTS.density,
    ),
    edge: normalizeRequestedOption(
      settings.edge,
      edgeOptions,
      LEGACY_RECIPE_DEFAULTS.edge,
    ),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const recipePaletteDirections = new Set<RecipePaletteDirection>([
  ...concretePaletteDirections,
  "snapshot",
]);
const interactionBiases = new Set<ResolvedInteractionBias>(interactionBiasOptions);
const rhythms = new Set<ResolvedRhythm>(rhythmOptions);
const compositions = new Set<ResolvedComposition>(compositionOptions);
const densities = new Set<ResolvedDensity>(densityOptions);
const edges = new Set<ResolvedEdge>(edgeOptions);

const optionalEnum = <T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T,
) => (value === undefined ? fallback : typeof value === "string" && allowed.has(value as T) ? value as T : null);

const normalizeLabLayer = (value: unknown): LabLayer | null => {
  if (!isRecord(value)) return null;
  const params = Array.isArray(value.params) ? value.params : [];
  const speed = isRecord(value.speed) ? value.speed : null;
  if (
    !Number.isInteger(value.studyId) ||
    (value.studyId as number) < 0 ||
    typeof value.name !== "string" ||
    !Number.isInteger(value.chapter) ||
    !Number.isInteger(value.variant) ||
    !Number.isInteger(value.kernel) ||
    params.length !== 4 ||
    !params.every(isFiniteNumber) ||
    !isFiniteNumber(value.seed) ||
    !isFiniteNumber(value.intensity) ||
    !isFiniteNumber(value.scale) ||
    !isFiniteNumber(value.angle) ||
    !isFiniteNumber(value.warp) ||
    !isFiniteNumber(value.weight) ||
    !isColor(value.colorA) ||
    !isColor(value.colorB) ||
    !speed ||
    !isFiniteNumber(speed.min) ||
    !isFiniteNumber(speed.max) ||
    !isFiniteNumber(speed.wanderRate) ||
    !isFiniteNumber(speed.surgeRate) ||
    !isFiniteNumber(speed.seed) ||
    (speed.surgeMix !== undefined && !isFiniteNumber(speed.surgeMix)) ||
    (value.offsetX !== undefined && !isFiniteNumber(value.offsetX)) ||
    (value.offsetY !== undefined && !isFiniteNumber(value.offsetY))
  ) {
    return null;
  }

  const speedMin = clamp(Math.min(speed.min, speed.max), 0, 2.6);
  const speedMax = clamp(Math.max(speed.min, speed.max), speedMin, 2.6);
  return {
    studyId: value.studyId as number,
    name: value.name,
    chapter: value.chapter as number,
    variant: Math.trunc(clamp(value.variant as number, 0, 143)),
    kernel: Math.trunc(clamp(value.kernel as number, 0, 50)),
    params: params.map((entry) => clamp(entry, -2, 2)) as [
      number,
      number,
      number,
      number,
    ],
    seed: Math.trunc(clamp(value.seed, 0, 4294967295)) >>> 0,
    intensity: clamp(value.intensity, 0, 1),
    scale: clamp(value.scale, 0.25, 2),
    angle: clamp(value.angle, -Math.PI, Math.PI),
    warp: clamp(value.warp, 0, 0.25),
    weight: clamp(value.weight, 0, 1),
    colorA: value.colorA,
    colorB: value.colorB,
    speed: {
      min: speedMin,
      max: speedMax,
      wanderRate: clamp(speed.wanderRate, 0, 2),
      surgeRate: clamp(speed.surgeRate, 0, 2),
      surgeMix: clamp(
        speed.surgeMix ?? LEGACY_RECIPE_DEFAULTS.surgeMix,
        0,
        1,
      ),
      seed: Math.trunc(clamp(speed.seed, 0, 4294967295)) >>> 0,
    },
    offsetX: clamp(
      value.offsetX ?? LEGACY_RECIPE_DEFAULTS.offsetX,
      -0.5,
      0.5,
    ),
    offsetY: clamp(
      value.offsetY ?? LEGACY_RECIPE_DEFAULTS.offsetY,
      -0.5,
      0.5,
    ),
  };
};

export function normalizeLabRecipe(value: unknown): LabRecipe | null {
  if (!isRecord(value) || !Array.isArray(value.layers)) return null;
  const layers = value.layers.map(normalizeLabLayer);
  const interactions = Array.isArray(value.interactions)
    ? value.interactions
    : [];
  const palette = Array.isArray(value.palette) ? value.palette : [];
  const interactionBias = optionalEnum(
    value.interactionBias,
    interactionBiases,
    LEGACY_RECIPE_DEFAULTS.interactionBias,
  );
  const rhythm = optionalEnum(
    value.rhythm,
    rhythms,
    LEGACY_RECIPE_DEFAULTS.rhythm,
  );
  const composition = optionalEnum(
    value.composition,
    compositions,
    LEGACY_RECIPE_DEFAULTS.composition,
  );
  const density = optionalEnum(
    value.density,
    densities,
    LEGACY_RECIPE_DEFAULTS.density,
  );
  const edge = optionalEnum(value.edge, edges, LEGACY_RECIPE_DEFAULTS.edge);
  if (
    !Number.isInteger(value.effectCount) ||
    value.effectCount !== layers.length ||
    layers.length < 1 ||
    layers.length > LAB_MAX_LAYERS ||
    layers.some((layer) => layer === null) ||
    typeof value.mixIntensity !== "string" ||
    !(value.mixIntensity in intensityRanges) ||
    !isFiniteNumber(value.interactionStrength) ||
    typeof value.paletteName !== "string" ||
    typeof value.paletteDirection !== "string" ||
    !recipePaletteDirections.has(value.paletteDirection as RecipePaletteDirection) ||
    palette.length < 1 ||
    palette.length > LAB_MAX_LAYERS ||
    !palette.every(isColor) ||
    interactions.length !== layers.length - 1 ||
    !interactions.every(
      (mode) => Number.isInteger(mode) && mode >= 0 && mode <= 5,
    ) ||
    !isFiniteNumber(value.seed) ||
    !interactionBias ||
    !rhythm ||
    !composition ||
    !density ||
    !edge ||
    (value.densityScale !== undefined && !isFiniteNumber(value.densityScale)) ||
    (value.edgeSharpness !== undefined && !isFiniteNumber(value.edgeSharpness))
  ) {
    return null;
  }

  return {
    seed: Math.trunc(clamp(value.seed, 0, 4294967295)) >>> 0,
    effectCount: layers.length,
    mixIntensity: value.mixIntensity as MixIntensity,
    interactionStrength: clamp(value.interactionStrength, 0.5, 1.5),
    paletteName: value.paletteName,
    paletteDirection: value.paletteDirection as RecipePaletteDirection,
    palette: palette.map((color) => color as string),
    layers: layers as LabLayer[],
    interactions: interactions.map((mode) => mode as InteractionMode),
    interactionBias,
    rhythm,
    composition,
    density,
    edge,
    densityScale: clamp(
      value.densityScale ?? LEGACY_RECIPE_DEFAULTS.densityScale,
      0.5,
      2,
    ),
    edgeSharpness: clamp(
      value.edgeSharpness ?? LEGACY_RECIPE_DEFAULTS.edgeSharpness,
      0.5,
      2,
    ),
  };
}

const resolveOption = <T extends string>(
  requested: T | "random",
  options: readonly T[],
  random: Random,
): T =>
  requested === "random"
    ? options[Math.floor(random() * options.length)]
    : requested;

const createSpeedProfile = (
  settings: Required<LabSettings>,
  rhythm: ResolvedRhythm,
  random: Random,
  index: number,
  count: number,
): SpeedProfile => {
  const span = settings.speedMax - settings.speedMin;
  const between = (from: number, to: number) =>
    settings.speedMin + span * (from + random() * (to - from));
  let min: number;
  let max: number;
  let wanderRate: number;
  let surgeRate: number;

  if (rhythm === "breath") {
    min = between(0.24, 0.34);
    max = between(0.56, 0.68);
    wanderRate = 0.06 + random() * 0.06;
    surgeRate = 0.07 + random() * 0.07;
  } else if (rhythm === "alternating") {
    min = between(0.04, 0.14);
    max = between(0.86, 0.98);
    wanderRate = 0.1 + random() * 0.1;
    surgeRate = 0.3 + random() * 0.22;
  } else if (rhythm === "pulse") {
    min = between(0.02, 0.08);
    max = between(0.9, 0.99);
    wanderRate = 0.04 + random() * 0.06;
    surgeRate = 0.18 + random() * 0.14;
  } else if (rhythm === "flow") {
    min = between(0.56, 0.68);
    max = between(0.86, 0.98);
    wanderRate = 0.15 + random() * 0.14;
    surgeRate = 0.04 + random() * 0.07;
  } else {
    const slotSpan = span / count;
    const slotStart = settings.speedMin + slotSpan * index;
    min = slotStart + slotSpan * random() * 0.18;
    max = Math.min(
      settings.speedMax,
      slotStart + slotSpan * (0.68 + random() * 0.28),
    );
    wanderRate = 0.12 + random() * 0.24;
    surgeRate = 0.035 + random() * 0.08;
  }

  return {
    min,
    max: Math.max(min, max),
    wanderRate,
    surgeRate,
    surgeMix: rhythmSurgeMix[rhythm],
    seed: Math.floor(random() * 4294967296) >>> 0,
  };
};

const compositionTransform = (
  composition: ResolvedComposition,
  index: number,
  count: number,
  fallbackAngle: number,
) => {
  const side = index % 2 === 0 ? -1 : 1;
  if (composition === "horizontal") {
    return { offsetX: side * 0.3, offsetY: (index / Math.max(1, count - 1) - 0.5) * 0.12, angle: 0 };
  }
  if (composition === "center-collision") {
    return { offsetX: side * 0.32, offsetY: side * 0.04, angle: side * -0.16 };
  }
  if (composition === "pincer") {
    const lane = index % 3;
    return { offsetX: side * (lane === 1 ? 0.18 : 0.38), offsetY: (lane - 1) * 0.13, angle: side * -0.28 };
  }
  if (composition === "vortex") {
    const theta = (Math.PI * 2 * index) / count;
    return {
      offsetX: Math.cos(theta) * 0.26,
      offsetY: Math.sin(theta) * 0.26,
      angle: theta + Math.PI / 2,
    };
  }
  if (composition === "interlace") {
    return { offsetX: side * 0.22, offsetY: -side * 0.2, angle: side * 0.62 };
  }
  return { offsetX: 0, offsetY: 0, angle: fallbackAngle };
};

const interactionModeFor = (
  bias: ResolvedInteractionBias,
  random: Random,
): InteractionMode => {
  if (bias === "free") return Math.floor(random() * 6) as InteractionMode;
  const preferred = interactionBiasOptions.indexOf(bias) - 1;
  return (random() < 0.72 ? preferred : Math.floor(random() * 6)) as InteractionMode;
};

export function createLabRecipe(
  requested: LabSettings | number,
  seed: number,
  studies: readonly MotionStudy[] = MOTION_STUDIES,
): LabRecipe | null {
  const settings = normalizeSettings(
    typeof requested === "number"
      ? { ...DEFAULT_LAB_SETTINGS, effectCount: requested }
      : requested,
  );
  const activeStudies = [
    ...new Map(studies.map((motionStudy) => [motionStudy.id, motionStudy])).values(),
  ];
  if (activeStudies.length === 0) return null;
  const count = Math.min(settings.effectCount, activeStudies.length);
  const random = seededRandom(seed);
  const interactionBias = resolveOption(
    settings.interactionBias,
    interactionBiasOptions,
    random,
  );
  const rhythm = resolveOption(settings.rhythm, rhythmOptions, random);
  const composition = resolveOption(
    settings.composition,
    compositionOptions,
    random,
  );
  const density = resolveOption(settings.density, densityOptions, random);
  const edge = resolveOption(settings.edge, edgeOptions, random);
  const selected: MotionStudy[] = [];
  for (let index = 0; index < count; index += 1) {
    selected.push(pickWeightedStudy(random, selected, activeStudies));
  }

  const palette = createPalette(random, count, settings.paletteDirection);
  const intensityRange = intensityRanges[settings.mixIntensity];
  const rawWeights = selected.map(() => 0.72 + random() * 0.56);
  const weightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const layers = selected.map((motionStudy, index): LabLayer => {
    const intensityUnit = random();
    const warpUnit = random();
    const fallbackAngle = (random() - 0.5) * 1.2;
    const transform = compositionTransform(
      composition,
      index,
      count,
      fallbackAngle,
    );
    const densityIntensity = density === "thin" ? 0.82 : density === "dense" ? 1.12 : 1;

    return {
      studyId: motionStudy.id,
      name: motionStudy.name,
      chapter: motionStudy.chapter,
      variant: motionStudy.shaderVariant,
      kernel: motionStudy.kernel,
      params: motionStudy.params,
      seed: Math.floor(random() * 4294967296) >>> 0,
      intensity:
        Math.min(
          1,
          (intensityRange.intensity[0] +
            intensityUnit *
              (intensityRange.intensity[1] - intensityRange.intensity[0])) *
            densityIntensity,
        ),
      scale: 0.78 + random() * 0.62,
      angle: transform.angle,
      warp:
        intensityRange.warp[0] +
        warpUnit * (intensityRange.warp[1] - intensityRange.warp[0]),
      weight: rawWeights[index] / weightTotal,
      colorA: palette.colors[index % palette.colors.length],
      colorB: palette.colors[(index + 1) % palette.colors.length],
      speed: createSpeedProfile(settings, rhythm, random, index, count),
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
    };
  });
  const interactions = Array.from(
    { length: count - 1 },
    () => interactionModeFor(interactionBias, random),
  );

  return {
    seed: seed >>> 0,
    effectCount: count,
    mixIntensity: settings.mixIntensity,
    interactionStrength: intensityRange.strength,
    paletteName: palette.name,
    paletteDirection: palette.direction,
    palette: palette.colors,
    layers,
    interactions,
    interactionBias,
    rhythm,
    composition,
    density,
    edge,
    densityScale: densityScales[density],
    edgeSharpness: edgeSharpnesses[edge],
  };
}

export function createSingleEffectRecipe(config: CardConfig): LabRecipe {
  const motionStudy = MOTION_STUDIES.find(({ id }) => id === config.studyId);
  return {
    seed: config.seed >>> 0,
    effectCount: 1,
    mixIntensity: "balanced",
    interactionStrength: 1,
    paletteName: paletteNames.snapshot,
    paletteDirection: "snapshot",
    palette: [config.colorA, config.colorB],
    layers: [
      {
        studyId: config.studyId,
        name: motionStudy?.name ?? config.label,
        chapter: motionStudy?.chapter ?? Math.floor(config.studyId / 12),
        variant: config.variant,
        kernel: config.kernel,
        params: config.params,
        seed: config.seed >>> 0,
        intensity: config.intensity,
        scale: 1,
        angle: 0,
        warp: 0,
        weight: 1,
        colorA: config.colorA,
        colorB: config.colorB,
        speed: {
          min: config.speed,
          max: config.speed,
          wanderRate: 0,
          surgeRate: 0,
          surgeMix: LEGACY_RECIPE_DEFAULTS.surgeMix,
          seed: config.seed >>> 0,
        },
        offsetX: LEGACY_RECIPE_DEFAULTS.offsetX,
        offsetY: LEGACY_RECIPE_DEFAULTS.offsetY,
      },
    ],
    interactions: [],
    interactionBias: LEGACY_RECIPE_DEFAULTS.interactionBias,
    rhythm: LEGACY_RECIPE_DEFAULTS.rhythm,
    composition: LEGACY_RECIPE_DEFAULTS.composition,
    density: LEGACY_RECIPE_DEFAULTS.density,
    edge: LEGACY_RECIPE_DEFAULTS.edge,
    densityScale: LEGACY_RECIPE_DEFAULTS.densityScale,
    edgeSharpness: LEGACY_RECIPE_DEFAULTS.edgeSharpness,
  };
}

export function formatLabRecipe(recipe: LabRecipe) {
  const studies = recipe.layers
    .map((layer) => `${String(layer.studyId + 1).padStart(2, "0")} ${layer.name}`)
    .join(" × ");
  const interactions = recipe.interactions
    .map((mode) => INTERACTION_LABELS[mode])
    .join(" + ");
  return interactions ? `${studies} / ${interactions}` : studies;
}

export function packLabRecipe(recipe: LabRecipe): PackedLabRecipe {
  const variants = new Int32Array(LAB_MAX_LAYERS);
  const kernels = new Int32Array(LAB_MAX_LAYERS);
  const modes = new Int32Array(LAB_MAX_LAYERS);
  const seeds = new Float32Array(LAB_MAX_LAYERS);
  const intensities = new Float32Array(LAB_MAX_LAYERS);
  const params = new Float32Array(LAB_MAX_LAYERS * 4);
  const colorsA = new Float32Array(LAB_MAX_LAYERS * 3);
  const colorsB = new Float32Array(LAB_MAX_LAYERS * 3);
  const transforms = new Float32Array(LAB_MAX_LAYERS * 4);
  const offsets = new Float32Array(LAB_MAX_LAYERS * 2);

  recipe.layers.forEach((layer, index) => {
    variants[index] = layer.variant;
    kernels[index] = layer.kernel;
    modes[index] = index === 0 ? 0 : recipe.interactions[index - 1];
    seeds[index] = toShaderSeed(layer.seed);
    intensities[index] = layer.intensity;
    params.set(layer.params, index * 4);
    colorsA.set(hexToRgb(layer.colorA), index * 3);
    colorsB.set(hexToRgb(layer.colorB), index * 3);
    transforms.set(
      [layer.scale, layer.angle, layer.weight, layer.warp],
      index * 4,
    );
    offsets.set([layer.offsetX, layer.offsetY], index * 2);
  });

  return {
    interactionStrength: recipe.interactionStrength,
    densityScale: recipe.densityScale,
    edgeSharpness: recipe.edgeSharpness,
    variants,
    kernels,
    modes,
    seeds,
    intensities,
    params,
    colorsA,
    colorsB,
    transforms,
    offsets,
  };
}
