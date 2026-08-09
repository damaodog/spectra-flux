import assert from "node:assert/strict";
import test from "node:test";
import * as labCore from "../app/lab/lab-core.ts";
import {
  DEFAULT_LAB_SETTINGS,
  INTERACTION_LABELS,
  LAB_MAX_LAYERS,
  advancePhaseTimes,
  createLabRecipe,
  createSingleEffectRecipe,
  formatLabRecipe,
  packLabRecipe,
  velocityAt,
} from "../app/lab/lab-core.ts";
import { MOTION_STUDIES } from "../app/motion-catalog.ts";

test("normalizes version-one recipes with stable version-two defaults", () => {
  assert.equal(typeof labCore.normalizeLabRecipe, "function");
  const legacy = createLabRecipe(DEFAULT_LAB_SETTINGS, 90210);
  assert.ok(legacy);
  const normalized = labCore.normalizeLabRecipe(structuredClone(legacy));
  assert.ok(normalized);
  assert.equal(normalized.interactionBias, "free");
  assert.equal(normalized.rhythm, "wander");
  assert.equal(normalized.composition, "automatic");
  assert.equal(normalized.density, "standard");
  assert.equal(normalized.edge, "mixed");
  assert.equal(normalized.densityScale, 1);
  assert.equal(normalized.edgeSharpness, 1);
  assert.deepEqual(
    normalized.layers.map((layer) => [
      layer.offsetX,
      layer.offsetY,
      layer.speed.surgeMix,
    ]),
    normalized.layers.map(() => [0, 0, 0.18]),
  );
});

test("recipes honor 1–6 effects, active studies, and deterministic settings", () => {
  for (let count = 1; count <= LAB_MAX_LAYERS; count += 1) {
    const settings = { ...DEFAULT_LAB_SETTINGS, effectCount: count };
    const recipe = createLabRecipe(settings, 20260808 + count);
    assert.ok(recipe);
    assert.deepEqual(recipe, createLabRecipe(settings, 20260808 + count));
    assert.equal(recipe.effectCount, count);
    assert.equal(recipe.layers.length, count);
    assert.equal(new Set(recipe.layers.map(({ studyId }) => studyId)).size, count);
    assert.equal(recipe.interactions.length, count - 1);
  }

  const active = MOTION_STUDIES.filter(({ id }) => ![0, 3, 7].includes(id));
  const recipe = createLabRecipe(
    { ...DEFAULT_LAB_SETTINGS, effectCount: 6 },
    88,
    active,
  );
  assert.ok(recipe);
  assert.ok(recipe.layers.every(({ studyId }) => ![0, 3, 7].includes(studyId)));
  assert.equal(createLabRecipe(DEFAULT_LAB_SETTINGS, 1, []), null);
});

test("mix intensity changes interaction fields without changing speed", () => {
  const base = {
    ...DEFAULT_LAB_SETTINGS,
    effectCount: 3,
    speedMin: 0.3,
    speedMax: 1.4,
    paletteDirection: "triadic",
  };
  const soft = createLabRecipe({ ...base, mixIntensity: "soft" }, 71);
  const intense = createLabRecipe({ ...base, mixIntensity: "intense" }, 71);
  assert.ok(soft && intense);
  assert.deepEqual(
    soft.layers.map(({ speed }) => speed),
    intense.layers.map(({ speed }) => speed),
  );
  assert.notDeepEqual(
    soft.layers.map(({ warp }) => warp),
    intense.layers.map(({ warp }) => warp),
  );
  assert.ok(soft.interactionStrength < intense.interactionStrength);
});

test("speed ranges and palette directions stay inside user constraints", () => {
  for (const paletteDirection of [
    "analogous",
    "warm-cool",
    "triadic",
    "dominant-highlight",
    "low-saturation-ink",
  ]) {
    const recipe = createLabRecipe(
      {
        effectCount: 6,
        mixIntensity: "balanced",
        speedMin: 0.3,
        speedMax: 1.4,
        paletteDirection,
      },
      404,
    );
    assert.ok(recipe);
    assert.equal(recipe.paletteDirection, paletteDirection);
    assert.ok(recipe.palette.length >= 3 && recipe.palette.length <= 6);
    assert.ok(recipe.palette.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
    recipe.layers.forEach((layer) => {
      assert.ok(layer.speed.min >= 0.3);
      assert.ok(layer.speed.max <= 1.4);
      assert.ok(layer.speed.min <= layer.speed.max);
      assert.ok(layer.intensity >= 0 && layer.intensity <= 1);
    });
    assert.equal(
      new Set(recipe.layers.map(({ speed }) => `${speed.min}:${speed.max}`)).size,
      recipe.effectCount,
    );
  }
});

test("speed is bounded and accumulated phase never reverses", () => {
  const recipe = createLabRecipe(
    { ...DEFAULT_LAB_SETTINGS, effectCount: 6 },
    2026,
  );
  assert.ok(recipe);
  const phases = new Float32Array(LAB_MAX_LAYERS);
  let elapsed = 0;

  for (let frame = 0; frame < 1200; frame += 1) {
    const before = phases.slice();
    elapsed += 1 / 60;
    advancePhaseTimes(recipe, phases, elapsed, 1 / 60);
    recipe.layers.forEach((layer, index) => {
      const velocity = velocityAt(layer.speed, elapsed);
      assert.ok(velocity >= layer.speed.min && velocity <= layer.speed.max);
      assert.ok(phases[index] >= before[index]);
    });
  }
});

test("single-effect snapshots copy the exact visible configuration", () => {
  const recipe = createSingleEffectRecipe({
    title: "SPECTRA",
    subtitle: "COLOR AS A LIVING SYSTEM.",
    radius: 54,
    width: 400,
    height: 100,
    label: "01 · 柔雾扩散",
    studyId: 0,
    variant: 0,
    kernel: 0,
    params: [0, 0, 0, 0],
    seed: 42,
    colorA: "#ff896f",
    colorB: "#788dff",
    speed: 0.8,
    intensity: 0.7,
  });
  assert.equal(recipe.effectCount, 1);
  assert.equal(recipe.layers[0].seed, 42);
  assert.equal(recipe.layers[0].colorA, "#ff896f");
  assert.equal(recipe.layers[0].colorB, "#788dff");
  assert.equal(recipe.layers[0].speed.min, 0.8);
  assert.equal(recipe.layers[0].speed.max, 0.8);
  assert.deepEqual(recipe.interactions, []);
});

test("packing creates six fixed slots and readable copy", () => {
  const recipe = createLabRecipe(
    { ...DEFAULT_LAB_SETTINGS, effectCount: 3 },
    33,
  );
  assert.ok(recipe);
  const packed = packLabRecipe(recipe);

  assert.equal(packed.variants.length, LAB_MAX_LAYERS);
  assert.equal(packed.params.length, LAB_MAX_LAYERS * 4);
  assert.equal(packed.colorsA.length, LAB_MAX_LAYERS * 3);
  assert.equal(packed.transforms.length, LAB_MAX_LAYERS * 4);
  assert.equal(packed.interactionStrength, recipe.interactionStrength);
  assert.match(formatLabRecipe(recipe), / × /);
  recipe.interactions.forEach((mode) => assert.ok(mode in INTERACTION_LABELS));
});
