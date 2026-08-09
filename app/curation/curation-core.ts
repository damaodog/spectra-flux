import {
  normalizeLabRecipe,
  type LabRecipe,
} from "../lab/lab-core.ts";

export const CURATION_STORAGE_KEY = "spectra-curation-v1";
export const CURATION_EVENT = "spectra-curation-change";

export type ShowcaseEntry = {
  id: string;
  createdAt: number;
  source: "library" | "lab";
  recipe: LabRecipe;
};

export type CurationStateV2 = {
  version: 2;
  deletedStudyIds: number[];
  showcase: ShowcaseEntry[];
};

export type CurationState = CurationStateV2;

export const EMPTY_CURATION_STATE: CurationState = {
  version: 2,
  deletedStudyIds: [],
  showcase: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const normalizeRecipe = normalizeLabRecipe;

const normalizeEntry = (value: unknown): ShowcaseEntry | null => {
  if (!isRecord(value)) return null;
  const recipe = normalizeLabRecipe(value.recipe);
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
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) {
    return null;
  }
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
  return { version: 2, deletedStudyIds, showcase };
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
    interactionBias: recipe.interactionBias,
    rhythm: recipe.rhythm,
    composition: recipe.composition,
    density: recipe.density,
    edge: recipe.edge,
    densityScale: recipe.densityScale,
    edgeSharpness: recipe.edgeSharpness,
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
      offsetX: layer.offsetX,
      offsetY: layer.offsetY,
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
