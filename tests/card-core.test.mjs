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
import {
  MOTION_PAGE_SIZE,
  MOTION_STUDIES,
  getMotionPage,
} from "../app/motion-catalog.ts";

test("createPreset is deterministic for a seed", () => {
  assert.deepEqual(createPreset(2026), createPreset(2026));
  assert.notDeepEqual(createPreset(2026), createPreset(2027));
});

test("the default preview card is 400 by 100", () => {
  assert.equal(DEFAULT_CARD_WIDTH, 400);
  assert.equal(DEFAULT_CARD_HEIGHT, 100);
});

test("the catalog exposes thirty-six stable motion identities", () => {
  assert.equal(MOTION_PAGE_SIZE, 12);
  assert.equal(MOTION_STUDIES.length, 36);
  assert.equal(new Set(MOTION_STUDIES.map(({ id }) => id)).size, 36);
  assert.equal(new Set(MOTION_STUDIES.map(({ name }) => name)).size, 36);
  assert.deepEqual(
    [0, 2, 4, 10].map((index) => MOTION_STUDIES[index].name),
    ["柔雾扩散", "横向薄纱", "斜向漂移", "急速奔流"],
  );
});

test("the catalog splits into three exact pages", () => {
  assert.deepEqual(
    getMotionPage(0).map(({ id }) => id),
    Array.from({ length: 12 }, (_, index) => index),
  );
  assert.deepEqual(
    getMotionPage(1).map(({ id }) => id),
    Array.from({ length: 12 }, (_, index) => index + 12),
  );
  assert.deepEqual(
    getMotionPage(2).map(({ id }) => id),
    Array.from({ length: 12 }, (_, index) => index + 24),
  );
  assert.deepEqual(getMotionPage(99), []);
});

test("createGallery returns thirty-six deterministic configured studies", () => {
  const gallery = createGallery(2026);
  assert.equal(gallery.length, 36);
  assert.equal(gallery.length, SMOKE_VARIANT_COUNT);
  assert.deepEqual(
    gallery.map((card) => card.variant),
    Array.from({ length: 36 }, (_, index) => index),
  );
  assert.equal(new Set(gallery.map((card) => card.seed)).size, 36);
  assert.deepEqual(gallery, createGallery(2026));
  assert.notDeepEqual(gallery, createGallery(2027));
  gallery.forEach((study, index) => {
    assert.equal(study.kernel, MOTION_STUDIES[index].kernel);
    assert.deepEqual(study.params, MOTION_STUDIES[index].params);
    if (MOTION_STUDIES[index].speed !== null) {
      assert.equal(study.speed, MOTION_STUDIES[index].speed);
    }
  });
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
    kernel: 0,
    params: [0, 0, 0, 0],
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
    kernel: 1,
    params: [0.92, 0.48, 0.22, 0.74],
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

test("the shader exposes bounded material kernels", () => {
  assert.match(FRAGMENT_SHADER, /uniform int kernel;/);
  assert.match(FRAGMENT_SHADER, /uniform vec4 studyParams;/);
  [
    "veilField",
    "filmField",
    "lensField",
    "glowField",
    "waveField",
    "gelField",
    "magnetField",
    "ringField",
    "tensionField",
    "interferenceField",
    "forceField",
    "filamentField",
  ].forEach((name) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`));
  });
  assert.doesNotMatch(
    FRAGMENT_SHADER,
    /sampler2D|framebuffer|particles|glitch|scanline/i,
  );
});

test("embed transfers kernel tuning to WebGL", () => {
  const html = buildEmbed({
    title: "SPECTRA",
    subtitle: "COLOR AS A LIVING SYSTEM.",
    label: "STYLE 13",
    colorA: "#64e0c1",
    colorB: "#2778ff",
    seed: 2026,
    speed: 0.64,
    intensity: 0.74,
    radius: 54,
    width: 400,
    height: 100,
    variant: 12,
    kernel: 2,
    params: [1.18, 0.74, 0.34, 0.62],
  });

  assert.match(html, /uniform1i\(kernel,2\)/);
  assert.match(html, /uniform4f\(studyParams,1\.18,0\.74,0\.34,0\.62\)/);
});

test("the fragment shader renders smoke without mixed effects", () => {
  assert.match(FRAGMENT_SHADER, /float smokeDensity\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 flowDrift\s*=/);
  assert.doesNotMatch(FRAGMENT_SHADER, /ripple|particles|veins|grain/i);
});

test("the shader keeps fast flow and isolates legacy structures", () => {
  assert.match(FRAGMENT_SHADER, /float flowTime\s*=\s*time;/);
  assert.match(FRAGMENT_SHADER, /float travelTime\s*=\s*time \* 0\.025;/);
  assert.match(FRAGMENT_SHADER, /vec2 flowDrift\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 travelDrift\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 macroDrift\s*=\s*travelDrift \* 1\.8;/);
  assert.match(FRAGMENT_SHADER, /float horizontalScale\s*=\s*1\.0 \/ 1\.4;/);
  assert.match(
    FRAGMENT_SHADER,
    /bool collisionFamily\s*=\s*legacy && \(variant < 2 \|\| variant == 6\);/,
  );
  assert.match(
    FRAGMENT_SHADER,
    /bool weaveFamily\s*=\s*legacy && variant >= 2 && variant < 4;/,
  );
  assert.match(
    FRAGMENT_SHADER,
    /bool vortexFamily\s*=\s*legacy && variant >= 4 && variant < 6;/,
  );
  assert.match(
    FRAGMENT_SHADER,
    /if\(weaveFamily \|\| fusionVariant \|\| fastVariant\)\{\s*fogC = fbm\(/,
  );
});

test("the selected legacy studies keep their original shader branches", () => {
  const identities = [
    [2, "warped.y"],
    [4, "mat2"],
    [10, "fastPhase"],
  ];

  identities.forEach(([variant, control]) => {
    assert.match(
      FRAGMENT_SHADER,
      new RegExp(`if\\(kernel == 0 && variant == ${variant}\\)[\\s\\S]*?${control}`),
    );
  });
  assert.doesNotMatch(FRAGMENT_SHADER, /sampler2D|framebuffer/);
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

test("the fragment shader can render viewport-local atlas cells", () => {
  assert.match(FRAGMENT_SHADER, /uniform vec2 viewportOrigin;/);
  assert.match(
    FRAGMENT_SHADER,
    /vec2 localFragCoord\s*=\s*gl_FragCoord\.xy - viewportOrigin;/,
  );
  assert.match(FRAGMENT_SHADER, /vec2 uv\s*=\s*localFragCoord \/ resolution\.xy;/);
});
