import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERACTION_LABELS,
  LAB_MAX_LAYERS,
  advancePhaseTimes,
  createLabRecipe,
  formatLabRecipe,
  packLabRecipe,
  velocityAt,
} from "../app/lab/lab-core.ts";

test("recipes are deterministic and contain the requested unique studies", () => {
  for (let count = 2; count <= LAB_MAX_LAYERS; count += 1) {
    const recipe = createLabRecipe(count, 20260808 + count);
    assert.deepEqual(recipe, createLabRecipe(count, 20260808 + count));
    assert.equal(recipe.effectCount, count);
    assert.equal(recipe.layers.length, count);
    assert.equal(new Set(recipe.layers.map(({ studyId }) => studyId)).size, count);
    assert.equal(recipe.interactions.length, count - 1);
    assert.ok(recipe.palette.length >= 3 && recipe.palette.length <= 6);
    assert.ok(
      Math.abs(recipe.layers.reduce((sum, layer) => sum + layer.weight, 0) - 1) <
        1e-6,
    );
  }
});

test("counts and randomized fields stay bounded", () => {
  assert.equal(createLabRecipe(1, 1).effectCount, 2);
  assert.equal(createLabRecipe(9, 1).effectCount, 6);
  const recipe = createLabRecipe(6, 88);

  recipe.layers.forEach((layer) => {
    assert.ok(layer.speed.min >= 0.12);
    assert.ok(layer.speed.max <= 2.6);
    assert.ok(layer.speed.max - layer.speed.min >= 0.28);
    assert.ok(layer.intensity >= 0.45 && layer.intensity <= 0.95);
    assert.match(layer.colorA, /^#[0-9a-f]{6}$/i);
    assert.match(layer.colorB, /^#[0-9a-f]{6}$/i);
  });
  recipe.interactions.forEach((mode) => {
    assert.ok(mode in INTERACTION_LABELS);
  });
});

test("speed is bounded and accumulated phase never reverses", () => {
  const recipe = createLabRecipe(6, 2026);
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

test("packing creates six fixed slots and readable copy", () => {
  const recipe = createLabRecipe(3, 33);
  const packed = packLabRecipe(recipe);

  assert.equal(packed.variants.length, LAB_MAX_LAYERS);
  assert.equal(packed.params.length, LAB_MAX_LAYERS * 4);
  assert.equal(packed.colorsA.length, LAB_MAX_LAYERS * 3);
  assert.equal(packed.transforms.length, LAB_MAX_LAYERS * 4);
  assert.match(formatLabRecipe(recipe), / × /);
  assert.match(formatLabRecipe(recipe), / \/ /);
});
