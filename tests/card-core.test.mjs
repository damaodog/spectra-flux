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

const expectedV2Names = [
  "柔雾扩散", "横向薄纱", "斜向漂移", "急速奔流",
  "双向潮缝", "织带交叠", "剪切尾流", "云脊翻涌",
  "绸带塌缩", "丝线回声", "逆层卷吸", "雾幕呼吸",
  "油膜涌色", "柔焦色蚀", "焦散折叠", "玻璃对撞",
  "棱镜绽放", "珠光脉冲", "蛋白石裂隙", "虹彩虹吸",
  "折射泡沫", "发光膜面", "柔波干涉", "虹彩脉络",
  "液面干涉", "相位潮汐", "细胞融汇", "涡旋合并",
  "射流撞击", "冲击环", "逆流撕裂", "黏性坍缩",
  "边界卷起", "密度呼吸", "潮汐剪切", "湍流编织",
];

const expectedExpansionNames = [
  "晶核萌生", "冰枝蔓延", "矿脉贯穿", "棱面折叠",
  "晶簇碰撞", "裂隙发光", "结晶潮汐", "宝石呼吸",
  "晶格错位", "盐花扩散", "棱镜破片", "晶体坍缩",
  "磁极对撞", "电弧跃迁", "场线缠绕", "脉冲爆发",
  "等离子喷流", "电荷扩散", "相位闪移", "环形放电",
  "双极撕裂", "磁暴呼吸", "能量虹吸", "雷暴织网",
  "双星绕行", "引力深井", "日冕喷发", "星云融合",
  "黑洞吸积", "行星潮汐", "彗尾漂移", "超新星扩散",
  "星团呼吸", "暗质牵引", "引力透镜", "宇宙网脉",
];

test("createPreset is deterministic for a seed", () => {
  assert.deepEqual(createPreset(2026), createPreset(2026));
  assert.notDeepEqual(createPreset(2026), createPreset(2027));
});

test("the default preview card is 400 by 100", () => {
  assert.equal(DEFAULT_CARD_WIDTH, 400);
  assert.equal(DEFAULT_CARD_HEIGHT, 100);
});

test("the catalog exposes seventy-two stable motion identities", () => {
  assert.equal(MOTION_PAGE_SIZE, 12);
  assert.equal(MOTION_STUDIES.length, 72);
  assert.equal(new Set(MOTION_STUDIES.map(({ id }) => id)).size, 72);
  assert.equal(new Set(MOTION_STUDIES.map(({ name }) => name)).size, 72);
  assert.deepEqual(
    MOTION_STUDIES.map(({ id }) => id),
    Array.from({ length: 72 }, (_, index) => index),
  );
});

test("the catalog preserves the approved first thirty-six studies", () => {
  assert.deepEqual(MOTION_STUDIES.slice(0, 36).map(({ name }) => name), expectedV2Names);
  assert.deepEqual(
    [0, 1, 2, 3, 12, 13, 24, 25, 26].map((index) => {
      const study = MOTION_STUDIES[index];
      return [study.shaderVariant, study.kernel, study.speed];
    }),
    [
      [0, 0, null], [2, 0, null], [4, 0, null], [10, 0, 1.6],
      [12, 2, 0.64], [21, 5, 0.48],
      [29, 10, 0.8], [31, 10, 0.52], [33, 9, 0.6],
    ],
  );
});

test("the expansion catalog has exact names, chapters, and bounded kernels", () => {
  assert.deepEqual(
    MOTION_STUDIES.slice(36).map(({ name }) => name),
    expectedExpansionNames,
  );
  assert.deepEqual(
    MOTION_STUDIES.map(({ chapter }) => chapter),
    Array.from({ length: 72 }, (_, index) => Math.floor(index / 12)),
  );
  assert.deepEqual(
    [...new Set(MOTION_STUDIES.slice(36).map(({ kernel }) => kernel))],
    Array.from({ length: 18 }, (_, index) => index + 27),
  );
});

test("gallery display identity is independent from shader identity", () => {
  const gallery = createGallery(2026);
  assert.deepEqual(
    gallery.map(({ studyId }) => studyId),
    Array.from({ length: 72 }, (_, index) => index),
  );
  assert.deepEqual(gallery.slice(0, 4).map(({ variant }) => variant), [0, 2, 4, 10]);
  assert.deepEqual(gallery.slice(12, 14).map(({ variant }) => variant), [12, 21]);
  assert.deepEqual(gallery.slice(24, 27).map(({ variant }) => variant), [29, 31, 33]);
});

test("the catalog splits into six exact pages", () => {
  for (let page = 0; page < 6; page += 1) {
    assert.deepEqual(
      getMotionPage(page).map(({ id }) => id),
      Array.from({ length: 12 }, (_, index) => index + page * 12),
    );
  }
  assert.deepEqual(getMotionPage(99), []);
});

test("createGallery returns seventy-two deterministic configured studies", () => {
  const gallery = createGallery(2026);
  assert.equal(gallery.length, 72);
  assert.equal(gallery.length, SMOKE_VARIANT_COUNT);
  assert.deepEqual(
    gallery.map((card) => card.studyId),
    Array.from({ length: 72 }, (_, index) => index),
  );
  assert.deepEqual(
    gallery.map((card) => card.variant),
    MOTION_STUDIES.map((study) => study.shaderVariant),
  );
  assert.equal(new Set(gallery.map((card) => card.seed)).size, 72);
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
    studyId: 0,
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
    studyId: 1,
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

test("the V2 veil chapter exposes seam braid wake and fold fields", () => {
  ["seamField", "braidField", "wakeField", "foldField"].forEach((name) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`));
  });
  assert.match(FRAGMENT_SHADER, /if\(kernel == 13\) materialFields = seamField/);
  assert.match(FRAGMENT_SHADER, /if\(kernel == 14\) materialFields = braidField/);
  assert.match(FRAGMENT_SHADER, /if\(kernel == 15\) materialFields = wakeField/);
  assert.match(FRAGMENT_SHADER, /if\(kernel == 16\) materialFields = foldField/);
});

test("the V2 optical chapter exposes five structural material fields", () => {
  [
    "causticFoldField",
    "glassCollisionField",
    "prismMembraneField",
    "opalChannelField",
    "veinField",
  ].forEach((name) => assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`)));
  [17, 18, 19, 20, 21].forEach((kernel) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`if\\(kernel == ${kernel}\\)`));
  });
});

test("the V2 force chapter exposes vortex jet shock collapse and shear fields", () => {
  [
    "vortexMergeField",
    "jetCollisionField",
    "shockField",
    "collapseField",
    "shearBraidField",
  ].forEach((name) => assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`)));
  [22, 23, 24, 25, 26].forEach((kernel) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`if\\(kernel == ${kernel}\\)`));
  });
});

test("the glow kernel keeps a narrow moving caustic ridge", () => {
  assert.match(FRAGMENT_SHADER, /float glowRidge\s*=/);
  assert.match(
    FRAGMENT_SHADER,
    /return vec4\(core, halo, glowRidge, haze \* halo\);/,
  );
});

test("the gel kernel exposes moving translucent rims", () => {
  assert.match(FRAGMENT_SHADER, /float gelRim\s*=/);
  assert.match(
    FRAGMENT_SHADER,
    /return vec4\(g1, g2, gelRim, gelCore\);/,
  );
});

test("the force kernel keeps a visible transverse channel", () => {
  assert.match(FRAGMENT_SHADER, /float forceChannel\s*=/);
  assert.match(
    FRAGMENT_SHADER,
    /return vec4\(left, right, forceChannel, forceShear\);/,
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
    studyId: 12,
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
