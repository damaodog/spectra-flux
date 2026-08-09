import {
  normalizeLabRecipe,
  type LabLayer,
  type LabRecipe,
} from "../lab/lab-core.ts";
import { MOTION_STUDIES } from "../motion-catalog.ts";

export const MAX_EMBED_TOKEN_LENGTH = 8192;

type EmbedLayerV1 = {
  i: number;
  v: number;
  k: number;
  p: readonly [number, number, number, number];
  s: number;
  n: number;
  z: number;
  a: number;
  w: number;
  g: number;
  c: string;
  d: string;
  t: LabLayer["speed"];
  o: readonly [number, number];
};

type EmbedRecipeV1 = {
  v: 1;
  s: number;
  g: number;
  p: string[];
  l: EmbedLayerV1[];
  m: number[];
  d: number;
  e: number;
};

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const fromBase64Url = (token: string) => {
  const base64 = token.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
};

const toPayload = (recipe: LabRecipe): EmbedRecipeV1 => ({
  v: 1,
  s: recipe.seed,
  g: recipe.interactionStrength,
  p: [...recipe.palette],
  l: recipe.layers.map((layer) => ({
    i: layer.studyId,
    v: layer.variant,
    k: layer.kernel,
    p: [...layer.params],
    s: layer.seed,
    n: layer.intensity,
    z: layer.scale,
    a: layer.angle,
    w: layer.warp,
    g: layer.weight,
    c: layer.colorA,
    d: layer.colorB,
    t: { ...layer.speed },
    o: [layer.offsetX, layer.offsetY],
  })),
  m: [...recipe.interactions],
  d: recipe.densityScale,
  e: recipe.edgeSharpness,
});

export function encodeEmbedRecipe(recipe: LabRecipe) {
  const normalized = normalizeLabRecipe(recipe);
  if (!normalized) throw new TypeError("Invalid SPECTRA recipe");
  const token = toBase64Url(JSON.stringify(toPayload(normalized)));
  if (token.length > MAX_EMBED_TOKEN_LENGTH) {
    throw new RangeError("SPECTRA recipe exceeds the embed URL limit");
  }
  return token;
}

export function decodeEmbedRecipe(token: string): LabRecipe | null {
  if (
    token.length === 0 ||
    token.length > MAX_EMBED_TOKEN_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(token)) as Partial<EmbedRecipeV1>;
    if (
      payload.v !== 1 ||
      !Array.isArray(payload.l) ||
      !Array.isArray(payload.m) ||
      !Array.isArray(payload.p)
    ) {
      return null;
    }
    const layers = payload.l.map((layer) => {
      const study = MOTION_STUDIES.find(({ id }) => id === layer.i);
      return {
        studyId: layer.i,
        name: study?.name ?? "嵌入效果",
        chapter: study?.chapter ?? Math.floor(layer.i / 12),
        variant: layer.v,
        kernel: layer.k,
        params: layer.p,
        seed: layer.s,
        intensity: layer.n,
        scale: layer.z,
        angle: layer.a,
        warp: layer.w,
        weight: layer.g,
        colorA: layer.c,
        colorB: layer.d,
        speed: layer.t,
        offsetX: layer.o?.[0],
        offsetY: layer.o?.[1],
      };
    });
    return normalizeLabRecipe({
      seed: payload.s,
      effectCount: layers.length,
      mixIntensity: "balanced",
      interactionStrength: payload.g,
      paletteName: "嵌入配方",
      paletteDirection: "snapshot",
      palette: payload.p,
      layers,
      interactions: payload.m,
      interactionBias: "free",
      rhythm: "wander",
      composition: "automatic",
      density: "standard",
      edge: "mixed",
      densityScale: payload.d,
      edgeSharpness: payload.e,
    });
  } catch {
    return null;
  }
}

export function buildEmbedSnippet(recipe: LabRecipe, origin: string) {
  const safeOrigin = new URL(origin).origin;
  const token = encodeEmbedRecipe(recipe);
  return `<iframe src="${safeOrigin}/embed?recipe=${token}" title="SPECTRA dynamic card" width="400" height="100" loading="lazy" referrerpolicy="no-referrer" style="border:0;border-radius:10px;overflow:hidden"></iframe>`;
}
