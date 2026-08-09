import assert from "node:assert/strict";
import test from "node:test";
import { createLabRecipe, DEFAULT_LAB_SETTINGS, packLabRecipe } from "../app/lab/lab-core.ts";
import * as embedCore from "../app/embed/embed-core.ts";

const recipe = createLabRecipe(
  {
    ...DEFAULT_LAB_SETTINGS,
    effectCount: 6,
    interactionBias: "collision",
    rhythm: "alternating",
    composition: "vortex",
    density: "dense",
    edge: "sharp",
  },
  90210,
);
assert.ok(recipe);

test("round-trips renderer data through a compact URL-safe token", () => {
  const token = embedCore.encodeEmbedRecipe(recipe);
  const decoded = embedCore.decodeEmbedRecipe(token);
  assert.ok(decoded);
  assert.deepEqual(packLabRecipe(decoded), packLabRecipe(recipe));
  assert.deepEqual(decoded.palette, recipe.palette);
  assert.doesNotMatch(token, /[+/=]/);

  const payload = Buffer.from(token, "base64url").toString("utf8");
  assert.doesNotMatch(payload, /paletteName|createdAt|"name"/);
});

test("builds a safe fixed-size lazy iframe snippet", () => {
  const html = embedCore.buildEmbedSnippet(recipe, "https://spectra.8538690.xyz/path");
  assert.match(html, /^<iframe /);
  assert.match(html, /width="400"/);
  assert.match(html, /height="100"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /title="SPECTRA dynamic card"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /border-radius:10px/);
  assert.match(html, /https:\/\/spectra\.8538690\.xyz\/embed\?recipe=/);
  assert.doesNotMatch(html, /\/path/);
});

test("rejects malformed oversized and altered tokens", () => {
  assert.equal(embedCore.decodeEmbedRecipe("not-a-recipe"), null);
  assert.equal(embedCore.decodeEmbedRecipe("a".repeat(8193)), null);
  const token = embedCore.encodeEmbedRecipe(recipe);
  assert.equal(embedCore.decodeEmbedRecipe(`${token.slice(0, -1)}x`), null);
});
