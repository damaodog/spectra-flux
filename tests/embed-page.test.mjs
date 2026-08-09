import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("embed client pauses offscreen hidden and reduced motion", async () => {
  assert.equal(existsSync("app/embed/embed-card.tsx"), true);
  const source = await readFile("app/embed/embed-card.tsx", "utf8");
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /visibilitychange/);
  assert.equal((source.match(/<LabPreview\b/g) ?? []).length, 1);
});

test("embed route has no site navigation or management UI", async () => {
  assert.equal(existsSync("app/embed/page.tsx"), true);
  const source = await readFile("app/embed/page.tsx", "utf8");
  assert.match(source, /decodeEmbedRecipe/);
  assert.doesNotMatch(source, /section-link|管理|RecipeAtlas|AtomicAtlas/);
});
