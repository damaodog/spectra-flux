import {
  LAB_MAX_LAYERS,
  type InteractionMode,
  type LabLayer,
  type LabRecipe,
  type MixIntensity,
  type RecipePaletteDirection,
} from "../lab/lab-core.ts";

export const CURATION_STORAGE_KEY = "spectra-curation-v1";
export const CURATION_EVENT = "spectra-curation-change";

export type ShowcaseEntry = {
  id: string;
  createdAt: number;
  source: "library" | "lab";
  recipe: LabRecipe;
};

export type CurationState = {
  version: 1;
  deletedStudyIds: number[];
  showcase: ShowcaseEntry[];
};

export const EMPTY_CURATION_STATE: CurationState = {
  version: 1,
  deletedStudyIds: [],
  showcase: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const mixIntensities = new Set<MixIntensity>([
  "soft",
  "balanced",
  "intense",
]);
const paletteDirections = new Set<RecipePaletteDirection>([
  "analogous",
  "warm-cool",
  "triadic",
  "dominant-highlight",
  "low-saturation-ink",
  "snapshot",
]);

const normalizeLayer = (value: unknown): LabLayer | null => {
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
    !isFiniteNumber(speed.seed)
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
      seed: Math.trunc(clamp(speed.seed, 0, 4294967295)) >>> 0,
    },
  };
};

export const normalizeRecipe = (value: unknown): LabRecipe | null => {
  if (!isRecord(value) || !Array.isArray(value.layers)) return null;
  const layers = value.layers.map(normalizeLayer);
  const interactions = Array.isArray(value.interactions)
    ? value.interactions
    : [];
  const palette = Array.isArray(value.palette) ? value.palette : [];
  if (
    !Number.isInteger(value.effectCount) ||
    value.effectCount !== layers.length ||
    layers.length < 1 ||
    layers.length > LAB_MAX_LAYERS ||
    layers.some((layer) => layer === null) ||
    typeof value.mixIntensity !== "string" ||
    !mixIntensities.has(value.mixIntensity as MixIntensity) ||
    !isFiniteNumber(value.interactionStrength) ||
    typeof value.paletteName !== "string" ||
    typeof value.paletteDirection !== "string" ||
    !paletteDirections.has(value.paletteDirection as RecipePaletteDirection) ||
    palette.length < 1 ||
    palette.length > LAB_MAX_LAYERS ||
    !palette.every(isColor) ||
    interactions.length !== layers.length - 1 ||
    !interactions.every(
      (mode) => Number.isInteger(mode) && mode >= 0 && mode <= 5,
    ) ||
    !isFiniteNumber(value.seed)
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
    palette: palette as string[],
    layers: layers as LabLayer[],
    interactions: interactions as InteractionMode[],
  };
};

const normalizeEntry = (value: unknown): ShowcaseEntry | null => {
  if (!isRecord(value)) return null;
  const recipe = normalizeRecipe(value.recipe);
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    !isFiniteNumber(value.createdAt) ||
    (value.source !== "library" && value.source !== "lab") ||
    !recipe
  ) {
    return null;
  }
  return {
    id: value.id,
    createdAt: Math.max(0, value.createdAt),
    source: value.source,
    recipe,
  };
};

export function normalizeCurationState(value: unknown): CurationState | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const rawDeleted = Array.isArray(value.deletedStudyIds)
    ? value.deletedStudyIds
    : [];
  const deletedStudyIds = [
    ...new Set(
      rawDeleted.filter(
        (id): id is number => Number.isInteger(id) && id >= 0 && id < 144,
      ),
    ),
  ].sort((a, b) => a - b);
  const entries = (Array.isArray(value.showcase) ? value.showcase : [])
    .map(normalizeEntry)
    .filter((entry): entry is ShowcaseEntry => Boolean(entry))
    .sort((a, b) => b.createdAt - a.createdAt);
  const ids = new Set<string>();
  const showcase = entries.filter((entry) => {
    if (ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
  return { version: 1, deletedStudyIds, showcase };
}

export function parseCurationState(serialized: string): CurationState | null {
  try {
    return normalizeCurationState(JSON.parse(serialized));
  } catch {
    return null;
  }
}

export const recipeFingerprint = (recipe: LabRecipe) =>
  JSON.stringify({
    seed: recipe.seed,
    effectCount: recipe.effectCount,
    mixIntensity: recipe.mixIntensity,
    interactionStrength: recipe.interactionStrength,
    paletteName: recipe.paletteName,
    paletteDirection: recipe.paletteDirection,
    palette: recipe.palette,
    layers: recipe.layers.map((layer) => ({
      studyId: layer.studyId,
      name: layer.name,
      chapter: layer.chapter,
      variant: layer.variant,
      kernel: layer.kernel,
      params: layer.params,
      seed: layer.seed,
      intensity: layer.intensity,
      scale: layer.scale,
      angle: layer.angle,
      warp: layer.warp,
      weight: layer.weight,
      colorA: layer.colorA,
      colorB: layer.colorB,
      speed: layer.speed,
    })),
    interactions: recipe.interactions,
  });

export function addShowcaseEntry(
  state: CurationState,
  entry: ShowcaseEntry,
): { state: CurationState; added: boolean } {
  const fingerprint = recipeFingerprint(entry.recipe);
  if (
    state.showcase.some(
      ({ recipe }) => recipeFingerprint(recipe) === fingerprint,
    )
  ) {
    return { state, added: false };
  }
  return {
    state: {
      ...state,
      showcase: [entry, ...state.showcase].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    },
    added: true,
  };
}

export const removeShowcaseEntry = (state: CurationState, entryId: string) => ({
  ...state,
  showcase: state.showcase.filter(({ id }) => id !== entryId),
});

export const deleteStudy = (state: CurationState, studyId: number) =>
  Number.isInteger(studyId) && studyId >= 0 && studyId < 144
    ? {
        ...state,
        deletedStudyIds: [...new Set([...state.deletedStudyIds, studyId])].sort(
          (a, b) => a - b,
        ),
      }
    : state;

export const serializeCurationState = (state: CurationState) => {
  const normalized = normalizeCurationState(state) ?? EMPTY_CURATION_STATE;
  return JSON.stringify(
    {
      version: normalized.version,
      deletedStudyIds: normalized.deletedStudyIds,
      showcase: normalized.showcase,
    },
    null,
    2,
  );
};
