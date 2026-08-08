import {
  SMOKE_TIME_SCALE,
  hexToRgb,
  toShaderSeed,
} from "../card-core.ts";
import { MOTION_STUDIES, type MotionStudy } from "../motion-catalog.ts";

export const LAB_MAX_LAYERS = 6;

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
};

export type LabRecipe = {
  seed: number;
  effectCount: number;
  paletteName: string;
  palette: string[];
  layers: LabLayer[];
  interactions: InteractionMode[];
};

export type PackedLabRecipe = {
  variants: Int32Array;
  kernels: Int32Array;
  modes: Int32Array;
  seeds: Float32Array;
  intensities: Float32Array;
  params: Float32Array;
  colorsA: Float32Array;
  colorsB: Float32Array;
  transforms: Float32Array;
};

type Random = () => number;

const paletteNames = [
  "邻近雾化",
  "冷暖对撞",
  "三角色交缠",
  "主色高光",
  "低饱和墨流",
] as const;

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

const createPalette = (random: Random, effectCount: number) => {
  const strategy = Math.floor(random() * paletteNames.length);
  const count = clamp(Math.max(3, effectCount), 3, LAB_MAX_LAYERS);
  const baseHue = random() * 360;
  const colors = Array.from({ length: count }, (_, index) => {
    const centered = index - (count - 1) / 2;
    const jitter = (random() - 0.5) * 12;

    if (strategy === 0) {
      return hslToHex(baseHue + centered * 24 + jitter, 68 + random() * 16, 67 + random() * 9);
    }
    if (strategy === 1) {
      const warmHue = 8 + random() * 44;
      const coolHue = 190 + random() * 78;
      return hslToHex(index % 2 === 0 ? warmHue : coolHue, 72 + random() * 18, 62 + random() * 10);
    }
    if (strategy === 2) {
      return hslToHex(baseHue + (index % 3) * 120 + jitter, 66 + random() * 20, 61 + random() * 12);
    }
    if (strategy === 3) {
      const accent = index === count - 1;
      return hslToHex(baseHue + (accent ? 155 + jitter : centered * 10), accent ? 92 : 64, accent ? 66 : 71);
    }
    return hslToHex(baseHue + centered * 42 + jitter, index === 0 ? 38 : 78, index === 0 ? 76 : 62 + random() * 9);
  });

  return { name: paletteNames[strategy], colors };
};

const pickWeightedStudy = (random: Random, selected: MotionStudy[]) => {
  const candidates = MOTION_STUDIES.filter(
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
    (profile.max - profile.min) * clamp(wander * 0.82 + surge * 0.18, 0, 1)
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

export function createLabRecipe(effectCount: number, seed: number): LabRecipe {
  const count = Math.trunc(clamp(effectCount, 2, LAB_MAX_LAYERS));
  const random = seededRandom(seed);
  const selected: MotionStudy[] = [];
  for (let index = 0; index < count; index += 1) {
    selected.push(pickWeightedStudy(random, selected));
  }

  const palette = createPalette(random, count);
  const rawWeights = selected.map(() => 0.72 + random() * 0.56);
  const weightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const layers = selected.map((motionStudy, index): LabLayer => {
    const baseSpeed = motionStudy.speed ?? 0.55 + random() * 0.85;
    const min = clamp(baseSpeed * (0.22 + random() * 0.25), 0.12, 1.4);
    const max = clamp(
      baseSpeed * (1.15 + random() * 0.85),
      min + 0.28,
      2.6,
    );

    return {
      studyId: motionStudy.id,
      name: motionStudy.name,
      chapter: motionStudy.chapter,
      variant: motionStudy.shaderVariant,
      kernel: motionStudy.kernel,
      params: motionStudy.params,
      seed: Math.floor(random() * 4294967296) >>> 0,
      intensity: 0.45 + random() * 0.5,
      scale: 0.78 + random() * 0.62,
      angle: (random() - 0.5) * 1.2,
      warp: 0.025 + random() * 0.075,
      weight: rawWeights[index] / weightTotal,
      colorA: palette.colors[index % palette.colors.length],
      colorB: palette.colors[(index + 1) % palette.colors.length],
      speed: {
        min,
        max,
        wanderRate: 0.12 + random() * 0.24,
        surgeRate: 0.035 + random() * 0.08,
        seed: Math.floor(random() * 4294967296) >>> 0,
      },
    };
  });
  const interactions = Array.from(
    { length: count - 1 },
    () => Math.floor(random() * 6) as InteractionMode,
  );

  return {
    seed: seed >>> 0,
    effectCount: count,
    paletteName: palette.name,
    palette: palette.colors,
    layers,
    interactions,
  };
}

export function formatLabRecipe(recipe: LabRecipe) {
  const studies = recipe.layers
    .map((layer) => `${String(layer.studyId + 1).padStart(2, "0")} ${layer.name}`)
    .join(" × ");
  const interactions = recipe.interactions
    .map((mode) => INTERACTION_LABELS[mode])
    .join(" + ");
  return `${studies} / ${interactions}`;
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
  });

  return {
    variants,
    kernels,
    modes,
    seeds,
    intensities,
    params,
    colorsA,
    colorsB,
    transforms,
  };
}
