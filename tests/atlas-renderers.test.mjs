import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("each atlas owns one WebGL2 context and copies to visible canvases", async () => {
  for (const path of [
    "../app/render/atomic-atlas.tsx",
    "../app/render/recipe-atlas.tsx",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.equal((source.match(/getContext\("webgl2"/g) || []).length, 1);
    assert.match(source, /document\.createElement\("canvas"\)/);
    assert.match(source, /getContext\("2d"\)/);
    assert.match(source, /drawImage\(/);
    assert.match(
      source,
      /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/,
    );
  }
});

test("recipe atlas packs six slots and advances independent clocks", async () => {
  const source = await readFile(
    new URL("../app/render/recipe-atlas.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /packLabRecipe\(/);
  assert.match(source, /advancePhaseTimes\(/);
  assert.match(source, /phaseTimesRef/);
  assert.match(source, /uniform1fv\(uniforms\.layerTimes/);
  assert.match(source, /LAB_FRAGMENT_SHADER/);
});
