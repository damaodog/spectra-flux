import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmbed,
  createGallery,
  createPreset,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  FRAGMENT_SHADER,
  SMOKE_VARIANT_COUNT,
} from "../app/card-core.ts";

test("createPreset is deterministic for a seed", () => {
  assert.deepEqual(createPreset(2026), createPreset(2026));
  assert.notDeepEqual(createPreset(2026), createPreset(2027));
});

test("the default card is 800 by 300", () => {
  assert.equal(DEFAULT_CARD_WIDTH, 800);
  assert.equal(DEFAULT_CARD_HEIGHT, 300);
});

test("createGallery returns six unique fixed variants", () => {
  const gallery = createGallery(2026);
  assert.equal(gallery.length, SMOKE_VARIANT_COUNT);
  assert.deepEqual(gallery.map((card) => card.variant), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(gallery.map((card) => card.seed)).size, 6);
  assert.deepEqual(gallery, createGallery(2026));
  assert.notDeepEqual(gallery, createGallery(2027));
});

test("buildEmbed escapes copy and has no network dependency", () => {
  const config = {
    title: "<SPECTRA>",
    subtitle: "COLOR & MOTION",
    label: "WEBGL / 001",
    colorA: "#ff866f",
    colorB: "#718cff",
    seed: 2026,
    speed: 0.8,
    intensity: 0.72,
    radius: 64,
    width: 800,
    height: 300,
    variant: 1,
  };

  const html = buildEmbed(config);

  assert.match(html, /&lt;SPECTRA&gt;/);
  assert.match(html, /getContext\("webgl2"/);
  assert.match(html, /2026/);
  assert.match(html, /uniform1i\(variant,1\)/);
  assert.match(html, /aspect-ratio:800\/300/);
  assert.match(html, /grid-template-columns:35% 65%/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("the fragment shader renders smoke without mixed effects", () => {
  assert.match(FRAGMENT_SHADER, /float smokeDensity\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 smokeDrift\s*=/);
  assert.doesNotMatch(FRAGMENT_SHADER, /ripple|particles|veins|grain/i);
});

test("the shader has six variants and independent alpha layers", () => {
  assert.match(FRAGMENT_SHADER, /uniform int variant;/);
  assert.match(FRAGMENT_SHADER, /float layerAlphaA\s*=/);
  assert.match(FRAGMENT_SHADER, /float layerAlphaB\s*=/);
  assert.match(FRAGMENT_SHADER, /float overlapInk\s*=/);
  assert.match(FRAGMENT_SHADER, /variant\s*==\s*5/);
  assert.doesNotMatch(FRAGMENT_SHADER, /cloudColor\s*=/);
});
