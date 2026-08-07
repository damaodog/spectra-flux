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
  SMOKE_TIME_SCALE,
  toShaderSeed,
} from "../app/card-core.ts";

test("createPreset is deterministic for a seed", () => {
  assert.deepEqual(createPreset(2026), createPreset(2026));
  assert.notDeepEqual(createPreset(2026), createPreset(2027));
});

test("the default preview card is 400 by 100", () => {
  assert.equal(DEFAULT_CARD_WIDTH, 400);
  assert.equal(DEFAULT_CARD_HEIGHT, 100);
});

test("createGallery returns six unique fixed variants", () => {
  const gallery = createGallery(2026);
  assert.equal(gallery.length, SMOKE_VARIANT_COUNT);
  assert.deepEqual(gallery.map((card) => card.variant), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(gallery.map((card) => card.seed)).size, 6);
  assert.deepEqual(gallery, createGallery(2026));
  assert.notDeepEqual(gallery, createGallery(2027));
});

test("shader seeds stay inside the precise 16-bit float range", () => {
  assert.equal(toShaderSeed(2674696568), 41336);
  assert.equal(toShaderSeed(4294967295), 65535);
  assert.equal(toShaderSeed(-1), 0);
});

test("smoke animation uses the shared eight-times scale", () => {
  assert.equal(SMOKE_TIME_SCALE, 8);

  const html = buildEmbed({
    title: "SPECTRA",
    subtitle: "COLOR AS A LIVING SYSTEM.",
    label: "STYLE 01",
    colorA: "#64e0c1",
    colorB: "#2778ff",
    seed: 2026,
    speed: 0.8,
    intensity: 0.74,
    radius: 54,
    width: 400,
    height: 100,
    variant: 0,
  });

  assert.match(html, /now\*\.001\*0\.8\*8/);
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
  assert.match(FRAGMENT_SHADER, /vec2 flowDrift\s*=/);
  assert.doesNotMatch(FRAGMENT_SHADER, /ripple|particles|veins|grain/i);
});

test("the shader keeps fast flow and limits the third field to weave variants", () => {
  assert.match(FRAGMENT_SHADER, /float flowTime\s*=\s*time;/);
  assert.match(FRAGMENT_SHADER, /float travelTime\s*=\s*time \* 0\.025;/);
  assert.match(FRAGMENT_SHADER, /vec2 flowDrift\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 travelDrift\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 macroDrift\s*=\s*travelDrift \* 1\.8;/);
  assert.match(FRAGMENT_SHADER, /float horizontalScale\s*=\s*1\.0 \/ 1\.4;/);
  assert.match(FRAGMENT_SHADER, /bool collisionFamily\s*=\s*variant < 2;/);
  assert.match(FRAGMENT_SHADER, /bool weaveFamily\s*=\s*variant >= 2 && variant < 4;/);
  assert.match(FRAGMENT_SHADER, /bool vortexFamily\s*=\s*variant >= 4;/);
  assert.match(
    FRAGMENT_SHADER,
    /if\(weaveFamily\)\{\s*fogC = fbm\(/,
  );
  assert.equal((FRAGMENT_SHADER.match(/= fbm\(/g) || []).length, 3);
});

test("fast smoke flow advects forward instead of returning every two seconds", () => {
  assert.match(
    FRAGMENT_SHADER,
    /vec2 flowDrift\s*=\s*vec2\(\s*flowTime \* 0\.10,\s*flowTime \* 0\.07\s*\);/,
  );
  assert.doesNotMatch(
    FRAGMENT_SHADER,
    /vec2 flowDrift\s*=\s*vec2\(\s*sin\(flowTime/,
  );
});

test("the shader exposes collision, interweaving, and vortex structures", () => {
  assert.match(FRAGMENT_SHADER, /vec2 vortexWarp\s*\(/);
  assert.match(FRAGMENT_SHADER, /float collisionMask\s*=/);
  assert.match(FRAGMENT_SHADER, /float fusionMask\s*=/);
  assert.match(FRAGMENT_SHADER, /float pairwiseWeave\s*=/);
  assert.match(FRAGMENT_SHADER, /float threeWayWeave\s*=/);
  assert.match(FRAGMENT_SHADER, /float layerAlphaA\s*=/);
  assert.match(FRAGMENT_SHADER, /float layerAlphaB\s*=/);
  assert.match(FRAGMENT_SHADER, /variant\s*==\s*5/);
  assert.doesNotMatch(FRAGMENT_SHADER, /framebuffer|sampler2D|ripple|particles|veins|grain/i);
});
