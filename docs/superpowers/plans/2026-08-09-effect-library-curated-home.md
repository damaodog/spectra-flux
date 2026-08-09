# Effect Library and Curated Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn SPECTRA FLUX into a local-first 144-effect library, constrained random mixing lab, and curated homepage populated only by explicit “展示到首页” actions.

**Architecture:** Keep the current shared-GLSL approach and separate pure data modules from browser persistence and rendering. Atomic library cards use one WebGL2 atlas per visible page; saved one- or multi-layer recipes use a second atlas implementation with six fixed layer slots per cell; the lab retains its single-canvas renderer. A versioned curation module owns literal deletions, exact-recipe deduplication, local storage, cross-route events, and JSON export.

**Tech Stack:** React 19, TypeScript 5.9, Vinext/Vite, WebGL2/GLSL, Node.js 22 test runner, ESLint, browser `localStorage`.

## Global Constraints

- Routes are exactly `/`, `/library`, and `/lab`.
- The atomic catalog contains exactly 144 stable consecutive internal IDs `0–143`, displayed as `01–144`.
- Existing studies `01–72` retain their names, shader variants, kernels, speeds, and parameters.
- The six new chapters contain exactly 12 studies each: 液态金属, 生物形态, 地质演化, 声学共振, 拓扑曲面, 相变幻景.
- Every card remains `400 × 100`, 4:1, with a `25% / 75%` text-to-color split and action controls outside the card.
- Library and homepage render no more than 12 cards per page and use one WebGL2 context per visible atlas.
- The random lab supports `1–6` unique active studies and one WebGL2 context.
- Literal library deletion has no trash, archive, recovery, or undo UI and removes the study from future lab selection.
- Saved homepage entries survive later source deletion and are ordered newest first.
- Exact current recipes are deduplicated; the same study may be saved again after its seed, palette, or motion configuration changes.
- Local persistence key is exactly `spectra-curation-v1`; malformed stored data is never silently overwritten.
- Reduced-motion mode renders one stable frame and does not auto-advance.
- No new runtime dependency is added.

---

### Task 1: Expand the stable motion catalog to 144 studies

**Files:**
- Create: `tests/motion-catalog.test.mjs`
- Modify: `app/motion-catalog.ts`
- Modify: `tests/card-core.test.mjs`

**Interfaces:**
- Produces: `MOTION_CHAPTERS`, `MOTION_STUDIES`, `MotionStudy`, `getMotionPage(pageIndex)`.
- `MotionStudy.chapter` becomes `number`; callers must not assume only six chapters.
- Internal IDs remain zero-based; visible numbers always render `study.id + 1`.

- [ ] **Step 1: Write the failing catalog contract test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  MOTION_CHAPTERS,
  MOTION_PAGE_SIZE,
  MOTION_STUDIES,
  getMotionPage,
} from "../app/motion-catalog.ts";

test("catalog exposes twelve stable chapters and 144 consecutive studies", () => {
  assert.equal(MOTION_PAGE_SIZE, 12);
  assert.equal(MOTION_CHAPTERS.length, 12);
  assert.equal(MOTION_STUDIES.length, 144);
  assert.deepEqual(MOTION_STUDIES.map(({ id }) => id),
    Array.from({ length: 144 }, (_, id) => id));
  assert.equal(new Set(MOTION_STUDIES.map(({ name }) => name)).size, 144);
  MOTION_CHAPTERS.forEach((chapter, index) => {
    assert.equal(chapter.index, index);
    assert.equal(chapter.startId, index * 12);
    assert.equal(getMotionPage(index).length, 12);
  });
  assert.deepEqual(getMotionPage(-1), []);
  assert.deepEqual(getMotionPage(12), []);
});

test("new study names and chapter boundaries are fixed", () => {
  assert.equal(MOTION_STUDIES[72].name, "汞面汇流");
  assert.equal(MOTION_STUDIES[83].name, "反光潮汐");
  assert.equal(MOTION_STUDIES[84].name, "细胞分裂");
  assert.equal(MOTION_STUDIES[107].name, "板块碰撞");
  assert.equal(MOTION_STUDIES[120].name, "莫比乌斯扭转");
  assert.equal(MOTION_STUDIES[143].name, "状态跃迁");
});
```

- [ ] **Step 2: Run the catalog test and verify the current 72-study catalog fails**

Run: `node --test tests/motion-catalog.test.mjs`

Expected: FAIL with `72 !== 144` or missing `MOTION_CHAPTERS` export.

- [ ] **Step 3: Add chapter metadata and the 72 fixed entries**

Define the chapter contract exactly:

```ts
export const MOTION_CHAPTERS = [
  "雾与薄纱", "光学材质", "流体力场", "晶体生长",
  "电磁脉冲", "天体引力", "液态金属", "生物形态",
  "地质演化", "声学共振", "拓扑曲面", "相变幻景",
].map((title, index) => ({ index, title, startId: index * MOTION_PAGE_SIZE }));

export type MotionStudy = {
  id: number;
  name: string;
  chapter: number;
  shaderVariant: number;
  kernel: number;
  speed: number | null;
  params: readonly [number, number, number, number];
};
```

Append these exact internal IDs and visual parameters after study `71`:

```ts
study(72, "汞面汇流", 72, 45, 0.76, [1.08, 0.58, 0.72, 0.46]),
study(73, "熔银卷吸", 73, 45, 0.92, [1.42, 0.44, 0.86, 0.62]),
study(74, "金属液滴", 74, 45, 0.68, [0.78, 0.82, 1.18, 0.54]),
study(75, "镜膜碰撞", 75, 45, 1.04, [1.28, 0.36, 0.64, 0.82]),
study(76, "铬流剪切", 76, 45, 1.18, [1.58, -0.52, 0.76, 0.68]),
study(77, "液金呼吸", 77, 45, 0.46, [0.62, 0.94, 0.52, 0.92]),
study(78, "镜池坍缩", 78, 45, 0.58, [0.72, 1.26, 0.68, 0.48]),
study(79, "合金分层", 79, 45, 0.72, [1.34, 0.68, 0.42, 0.74]),
study(80, "金属脉冲", 80, 45, 0.96, [0.94, 0.54, 1.32, 0.66]),
study(81, "熔镜涡旋", 81, 45, 0.88, [1.46, 0.42, 0.82, 0.78]),
study(82, "银幕撕裂", 82, 45, 1.12, [1.62, -0.46, 0.58, 0.84]),
study(83, "反光潮汐", 83, 45, 0.64, [1.16, 0.76, 0.92, 0.56]),
study(84, "细胞分裂", 84, 46, 0.62, [0.82, 0.72, 1.18, 0.58]),
study(85, "膜面融合", 85, 46, 0.54, [1.14, 0.86, 0.68, 0.74]),
study(86, "菌丝蔓延", 86, 46, 0.78, [1.52, 0.46, 0.76, 0.62]),
study(87, "组织褶皱", 87, 46, 0.66, [1.28, 0.64, 0.92, 0.48]),
study(88, "孢子扩散", 88, 46, 0.84, [0.74, 1.18, 0.52, 0.82]),
study(89, "有机脉动", 89, 46, 0.44, [0.58, 0.92, 0.48, 0.96]),
study(90, "软体卷吸", 90, 46, 0.72, [1.42, 0.54, 0.86, 0.68]),
study(91, "群落碰撞", 91, 46, 0.96, [1.24, 0.38, 0.72, 0.84]),
study(92, "脉络生长", 92, 46, 0.58, [1.56, 0.48, 0.62, 0.76]),
study(93, "细胞吞噬", 93, 46, 0.74, [0.88, 1.24, 0.78, 0.56]),
study(94, "生物膜呼吸", 94, 46, 0.42, [0.64, 0.88, 0.54, 0.94]),
study(95, "有机潮汐", 95, 46, 0.68, [1.36, 0.72, 0.84, 0.64]),
study(96, "岩层挤压", 96, 47, 0.54, [1.18, 0.84, 0.52, 0.72]),
study(97, "岩浆侵入", 97, 47, 0.86, [1.42, 0.48, 0.88, 0.64]),
study(98, "断层滑移", 98, 47, 1.02, [1.62, -0.54, 0.68, 0.78]),
study(99, "沉积褶皱", 99, 47, 0.58, [0.92, 0.78, 1.22, 0.52]),
study(100, "矿物流脉", 100, 47, 0.72, [1.48, 0.42, 0.76, 0.84]),
study(101, "侵蚀前沿", 101, 47, 0.66, [0.76, 1.14, 0.58, 0.68]),
study(102, "地幔对流", 102, 47, 0.48, [0.68, 1.28, 0.82, 0.56]),
study(103, "构造剪切", 103, 47, 1.12, [1.58, -0.46, 0.72, 0.82]),
study(104, "熔岩冷却", 104, 47, 0.62, [1.24, 0.62, 0.94, 0.58]),
study(105, "晶砂迁移", 105, 47, 0.82, [1.52, 0.36, 0.64, 0.76]),
study(106, "地层坍缩", 106, 47, 0.56, [0.72, 1.32, 0.68, 0.48]),
study(107, "板块碰撞", 107, 47, 0.94, [1.28, 0.52, 0.86, 0.84]),
study(108, "驻波节点", 108, 48, 0.72, [1.18, 0.68, 0.82, 0.56]),
study(109, "频率拍振", 109, 48, 0.88, [1.46, 0.42, 1.12, 0.64]),
study(110, "谐波膜面", 110, 48, 0.64, [0.86, 0.92, 0.72, 0.78]),
study(111, "声压碰撞", 111, 48, 1.06, [1.34, 0.38, 0.68, 0.86]),
study(112, "共振呼吸", 112, 48, 0.44, [0.62, 0.94, 0.48, 0.96]),
study(113, "相位抵消", 113, 48, 0.78, [1.52, -0.58, 0.84, 0.62]),
study(114, "节点跃迁", 114, 48, 0.98, [1.24, 0.46, 1.28, 0.74]),
study(115, "低频涌动", 115, 48, 0.38, [0.72, 1.24, 0.58, 0.88]),
study(116, "高频丝带", 116, 48, 1.18, [1.68, 0.34, 0.76, 0.72]),
study(117, "声场卷吸", 117, 48, 0.82, [1.36, 0.54, 0.92, 0.68]),
study(118, "谱线交织", 118, 48, 0.92, [1.58, 0.48, 0.62, 0.82]),
study(119, "回声扩散", 119, 48, 0.56, [0.78, 1.16, 0.68, 0.64]),
study(120, "莫比乌斯扭转", 120, 49, 0.72, [1.22, 0.64, 0.84, 0.76]),
study(121, "曲面折叠", 121, 49, 0.64, [1.48, 0.52, 1.14, 0.58]),
study(122, "拓扑孔洞", 122, 49, 0.82, [0.92, 1.18, 0.68, 0.84]),
study(123, "空间翻转", 123, 49, 0.94, [1.56, -0.48, 0.78, 0.72]),
study(124, "鞍面涌流", 124, 49, 0.58, [0.76, 0.88, 1.26, 0.62]),
study(125, "流形卷吸", 125, 49, 0.86, [1.42, 0.44, 0.92, 0.78]),
study(126, "内外反转", 126, 49, 0.68, [1.28, -0.62, 0.72, 0.66]),
study(127, "环面碰撞", 127, 49, 1.02, [1.18, 0.38, 1.18, 0.84]),
study(128, "曲率脉冲", 128, 49, 0.76, [0.88, 0.72, 1.34, 0.58]),
study(129, "连续形变", 129, 49, 0.48, [0.64, 1.22, 0.82, 0.72]),
study(130, "纽结解构", 130, 49, 0.92, [1.62, 0.46, 0.68, 0.86]),
study(131, "边界重连", 131, 49, 0.74, [1.34, 0.58, 0.94, 0.64]),
study(132, "凝结前沿", 132, 50, 0.54, [0.82, 0.84, 1.16, 0.62]),
study(133, "汽化涌升", 133, 50, 0.92, [1.46, 0.42, 0.78, 0.84]),
study(134, "结霜蔓延", 134, 50, 0.62, [1.52, 0.54, 0.68, 0.72]),
study(135, "熔解塌缩", 135, 50, 0.68, [0.74, 1.28, 0.84, 0.52]),
study(136, "升华漂移", 136, 50, 0.82, [1.34, 0.48, 0.72, 0.78]),
study(137, "晶核相变", 137, 50, 0.72, [1.18, 0.68, 1.24, 0.64]),
study(138, "液凝转化", 138, 50, 0.58, [0.88, 1.16, 0.62, 0.76]),
study(139, "凝胶呼吸", 139, 50, 0.42, [0.62, 0.94, 0.52, 0.96]),
study(140, "沸点爆发", 140, 50, 1.16, [1.58, 0.36, 0.86, 0.82]),
study(141, "冻融撕裂", 141, 50, 0.98, [1.44, -0.52, 0.74, 0.88]),
study(142, "相界碰撞", 142, 50, 0.86, [1.22, 0.46, 1.12, 0.72]),
study(143, "状态跃迁", 143, 50, 0.64, [0.92, 0.82, 0.68, 0.84]),
```

Change `getMotionPage` to derive its bound from `MOTION_CHAPTERS.length`.

- [ ] **Step 4: Update the existing catalog invariants without weakening the approved 01–72 checks**

In `tests/card-core.test.mjs`, change total-length, ID, gallery, seed-count, and chapter-array expectations from `72` to `144`; change the exact-page loop from `6` to `12`; rename the tests accordingly. Keep `expectedV2Names` unchanged. Restrict the existing second-expansion checks to `MOTION_STUDIES.slice(36, 72)` so studies 37–72 are still verified exactly, and leave every shader identity assertion for studies 01–72 intact.

- [ ] **Step 5: Run the catalog tests**

Run: `node --test tests/motion-catalog.test.mjs tests/card-core.test.mjs`

Expected: all catalog and existing card-core tests PASS.

- [ ] **Step 6: Commit the catalog expansion**

```bash
git add app/motion-catalog.ts tests/motion-catalog.test.mjs tests/card-core.test.mjs
git commit -m "feat: expand motion catalog to 144 studies"
```

### Task 2: Add six new shader families for the appended chapters

**Files:**
- Create: `tests/catalog-shader.test.mjs`
- Modify: `app/card-core.ts`

**Interfaces:**
- Consumes: catalog kernels `45–50` from Task 1.
- Produces: GLSL field functions `liquidMetalField`, `biomorphicField`, `geologicalField`, `acousticField`, `topologyField`, and `phaseChangeField` available to both atomic and lab shaders.

- [ ] **Step 1: Write the shader-source test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildEmbed, FRAGMENT_SHADER } from "../app/card-core.ts";

test("the six appended catalog families have GLSL fields and routes", () => {
  [
    "liquidMetalField", "biomorphicField", "geologicalField",
    "acousticField", "topologyField", "phaseChangeField",
  ].forEach((name) => assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`)));
  [45, 46, 47, 48, 49, 50].forEach((kernel) =>
    assert.match(FRAGMENT_SHADER, new RegExp(`if\\(kernel == ${kernel}\\)`)));
  assert.match(FRAGMENT_SHADER, /bool liquidMetalKernel = kernel == 45;/);
  assert.match(FRAGMENT_SHADER, /bool phaseChangeKernel = kernel == 50;/);
});

test("atomic embed preserves the highest appended kernel", () => {
  const html = buildEmbed({
    title: "SPECTRA", subtitle: "COLOR AS A LIVING SYSTEM.", label: "144 · 状态跃迁",
    colorA: "#ff896f", colorB: "#788dff", seed: 144, speed: 0.64,
    intensity: 0.7, radius: 54, width: 400, height: 100, studyId: 143,
    variant: 143, kernel: 50, params: [0.92, 0.82, 0.68, 0.84],
  });
  assert.match(html, /uniform1i\(kernel,50\)/);
});
```

- [ ] **Step 2: Run it and verify the new kernels are absent**

Run: `node --test tests/catalog-shader.test.mjs`

Expected: FAIL on the first missing GLSL function.

- [ ] **Step 3: Add six bounded field functions and route kernels 45–50**

Add these six bounded functions next to the existing field functions:

```glsl
vec4 liquidMetalField(vec2 p, float t, vec4 q){
  vec2 drift = vec2(t * (0.035 + q.y * 0.018), -t * 0.026);
  float body = fbm(p * vec2(1.1 + q.x * 0.28, 2.2 + q.z * 0.34) + drift);
  float fold = p.y - sin(p.x * (1.4 + q.x) - t * 0.12) * (0.12 + q.w * 0.06);
  float poolA = smoothstep(0.28, 0.72, body - fold * 0.32);
  float poolB = smoothstep(0.31, 0.75, 1.0 - body + fold * 0.26);
  float seam = softLine(poolA - poolB, 0.04, 0.16);
  float highlight = softLine(body - 0.58, 0.035, 0.11);
  return vec4(poolA, poolB, seam, highlight);
}

vec4 biomorphicField(vec2 p, float t, vec4 q){
  vec2 flow = p * (1.4 + q.x * 0.32) + vec2(t * 0.028, -t * 0.022);
  float cellA = fbm(flow + vec2(sin(t * 0.08), cos(t * 0.07)) * 0.22);
  float cellB = fbm(flow.yx * 1.17 + vec2(-t * 0.024, t * 0.019) + q.y);
  float membrane = softLine(cellA - cellB, 0.045 + q.w * 0.012, 0.18);
  float growth = smoothstep(0.32, 0.72, cellA + cellB * 0.34);
  float pulse = 0.5 + 0.5 * sin(t * (0.055 + q.z * 0.018));
  return vec4(growth, smoothstep(0.34, 0.76, cellB), membrane, membrane * pulse);
}

vec4 geologicalField(vec2 p, float t, vec4 q){
  float strataNoise = fbm(p * vec2(0.72, 3.4 + q.x) + vec2(t * 0.018, -t * 0.012));
  float pressure = p.y + sin(p.x * (1.1 + q.y) - t * 0.05) * 0.18;
  float layerA = band(pressure + (strataNoise - 0.5) * 0.38, 0.14 + q.w * 0.02);
  float layerB = band(pressure - 0.34 + (strataNoise - 0.5) * 0.24, 0.12);
  float fault = softLine(p.x * (0.42 + q.z * 0.08) - p.y * 0.27 + sin(t * 0.04) * 0.08, 0.035, 0.10);
  return vec4(layerA, layerB, fault, max(layerA, layerB) * fault);
}

vec4 acousticField(vec2 p, float t, vec4 q){
  float phaseA = p.x * (2.0 + q.x) + p.y * (1.2 + q.y * 0.4) - t * 0.10;
  float phaseB = p.x * (1.3 + q.z * 0.5) - p.y * 2.1 + t * 0.073;
  float waveA = 0.5 + 0.5 * sin(phaseA);
  float waveB = 0.5 + 0.5 * sin(phaseB);
  float node = softLine(waveA - waveB, 0.045, 0.20);
  float pressure = smoothstep(0.28, 0.76, waveA * 0.58 + waveB * 0.42);
  float echo = fbm(p * 1.4 + vec2(t * 0.018, -t * 0.014));
  return vec4(waveA, waveB, node, pressure * (0.62 + echo * 0.38));
}

vec4 topologyField(vec2 p, float t, vec4 q){
  float bend = sin(p.x * (1.0 + q.x) + t * 0.055) * (0.16 + q.w * 0.04);
  vec2 folded = vec2(p.x + sin(p.y * 1.7 - t * 0.04) * 0.16, p.y + bend);
  float surfaceA = fbm(folded * (1.1 + q.y * 0.25) + vec2(t * 0.02, 0.0));
  float surfaceB = fbm(folded.yx * (1.25 + q.z * 0.18) - vec2(0.0, t * 0.018));
  float boundary = softLine(surfaceA - surfaceB, 0.05, 0.17);
  float opening = smoothstep(0.22, 0.68, abs(surfaceA + surfaceB - 1.0));
  return vec4(surfaceA, surfaceB, boundary, opening * boundary);
}

vec4 phaseChangeField(vec2 p, float t, vec4 q){
  float temperature = fbm(p * vec2(1.0 + q.x * 0.22, 2.1 + q.y * 0.28) + vec2(t * 0.024, -t * 0.017));
  float threshold = 0.48 + sin(p.x * (1.2 + q.z) - t * 0.06) * (0.08 + q.w * 0.025);
  float solid = 1.0 - smoothstep(threshold - 0.16, threshold + 0.06, temperature);
  float liquid = smoothstep(threshold - 0.05, threshold + 0.18, temperature);
  float boundary = softLine(temperature - threshold, 0.025, 0.13);
  float vapor = smoothstep(0.62, 0.88, temperature + fbm(p * 2.8 - t * 0.012) * 0.16);
  return vec4(solid, liquid, boundary, vapor);
}
```

Route them in the existing `materialFields` selection:

```glsl
if(kernel == 45) materialFields = liquidMetalField(p, flowTime, studyParams);
if(kernel == 46) materialFields = biomorphicField(p, flowTime, studyParams);
if(kernel == 47) materialFields = geologicalField(p, flowTime, studyParams);
if(kernel == 48) materialFields = acousticField(p, flowTime, studyParams);
if(kernel == 49) materialFields = topologyField(p, flowTime, studyParams);
if(kernel == 50) materialFields = phaseChangeField(p, flowTime, studyParams);
```

Add family-specific color shaping beside the existing optical/crystal/electromagnetic/cosmic branches:

```glsl
bool liquidMetalKernel = kernel == 45;
bool biomorphicKernel = kernel == 46;
bool geologicalKernel = kernel == 47;
bool acousticKernel = kernel == 48;
bool topologyKernel = kernel == 49;
bool phaseChangeKernel = kernel == 50;
```

Metal raises moving highlights but clamps them below `1.0`; biomorphic and phase-change branches soften density boundaries; geological emphasizes layer pressure; acoustic avoids strobe by using spatial nodes with continuous low-frequency time; topology warps coordinates without discontinuous sign flips.

Update `buildEmbed` kernel normalization from maximum `44` to maximum `50`, so atomic snapshots from all appended chapters preserve their shader family.

- [ ] **Step 4: Run shader and existing shader-body tests**

Run: `node --test tests/catalog-shader.test.mjs tests/lab-shader.test.mjs`

Expected: 5 tests PASS and lab shader extraction still finds the shared study body.

- [ ] **Step 5: Commit the shader families**

```bash
git add app/card-core.ts tests/catalog-shader.test.mjs
git commit -m "feat: add six motion shader families"
```

### Task 3: Extend the random recipe core with user constraints and atomic snapshots

**Files:**
- Modify: `app/lab/lab-core.ts`
- Modify: `tests/lab-core.test.mjs`

**Interfaces:**
- Consumes: `MotionStudy[]`, `CardConfig`, active library pool.
- Produces: `LabSettings`, `DEFAULT_LAB_SETTINGS`, `createLabRecipe(settings, seed, studies = MOTION_STUDIES)`, `createSingleEffectRecipe(config)`, and unchanged packing/phase helpers.
- `createLabRecipe` returns `null` only when `studies` is empty.

- [ ] **Step 1: Replace the old count-only tests with failing constraint tests**

```js
const settings = {
  effectCount: 1,
  mixIntensity: "intense",
  speedMin: 0.3,
  speedMax: 1.4,
  paletteDirection: "triadic",
};
const recipe = createLabRecipe(settings, 20260809, MOTION_STUDIES.slice(0, 8));
assert.ok(recipe);
assert.equal(recipe.effectCount, 1);
assert.equal(recipe.mixIntensity, "intense");
assert.equal(recipe.paletteDirection, "triadic");
assert.ok(recipe.layers.every(({ speed }) => speed.min >= 0.3 && speed.max <= 1.4));
assert.deepEqual(recipe, createLabRecipe(settings, 20260809, MOTION_STUDIES.slice(0, 8)));
assert.equal(createLabRecipe(settings, 1, []), null);

const active = MOTION_STUDIES.filter(({ id }) => ![0, 3, 7].includes(id));
const activeRecipe = createLabRecipe({ ...settings, effectCount: 6 }, 88, active);
assert.ok(activeRecipe);
assert.ok(activeRecipe.layers.every(({ studyId }) => ![0, 3, 7].includes(studyId)));

const soft = createLabRecipe({ ...settings, effectCount: 3, mixIntensity: "soft" }, 71);
const intense = createLabRecipe({ ...settings, effectCount: 3, mixIntensity: "intense" }, 71);
assert.ok(soft && intense);
assert.deepEqual(soft.layers.map(({ speed }) => speed), intense.layers.map(({ speed }) => speed));
assert.notDeepEqual(soft.layers.map(({ warp }) => warp), intense.layers.map(({ warp }) => warp));

for (const paletteDirection of [
  "analogous", "warm-cool", "triadic", "dominant-highlight", "low-saturation-ink",
]) {
  const directed = createLabRecipe({ ...settings, paletteDirection }, 404);
  assert.ok(directed);
  assert.equal(directed.paletteDirection, paletteDirection);
  assert.ok(directed.palette.length >= 3 && directed.palette.length <= 6);
  assert.ok(directed.palette.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
}

const atomic = createSingleEffectRecipe({
  title: "SPECTRA", subtitle: "COLOR AS A LIVING SYSTEM.", radius: 54,
  width: 400, height: 100, label: "01 · 柔雾扩散", studyId: 0,
  variant: 0, kernel: 0, params: [0, 0, 0, 0], seed: 42,
  colorA: "#ff896f", colorB: "#788dff", speed: 0.8, intensity: 0.7,
});
assert.equal(atomic.effectCount, 1);
assert.equal(atomic.layers[0].speed.min, 0.8);
assert.equal(atomic.layers[0].speed.max, 0.8);
```

- [ ] **Step 2: Run and verify the old signature and lower bound fail**

Run: `node --test tests/lab-core.test.mjs`

Expected: FAIL because `createLabRecipe` does not accept `LabSettings` and clamps to 2.

- [ ] **Step 3: Define settings and recipe metadata**

```ts
export type MixIntensity = "soft" | "balanced" | "intense";
export type PaletteDirection =
  | "random" | "analogous" | "warm-cool" | "triadic"
  | "dominant-highlight" | "low-saturation-ink";

export type LabSettings = {
  effectCount: number;
  mixIntensity: MixIntensity;
  speedMin: number;
  speedMax: number;
  paletteDirection: PaletteDirection;
};

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  effectCount: 3,
  mixIntensity: "balanced",
  speedMin: 0.2,
  speedMax: 1.8,
  paletteDirection: "random",
};
```

Add `mixIntensity` and resolved `paletteDirection` to `LabRecipe`. Normalize settings to `1–6`, speed `0.1–2.6`, and at least `0.1` between bounds. Constrain `pickWeightedStudy` to the supplied active pool. Have the palette generator use the named direction, with `random` deterministically selecting one of the five concrete strategies.

- [ ] **Step 4: Apply settings without coupling speed and interaction intensity**

Use this range table inside recipe creation:

```ts
const intensityRanges = {
  soft: { intensity: [0.34, 0.62], warp: [0.012, 0.04], strength: 0.72 },
  balanced: { intensity: [0.45, 0.95], warp: [0.025, 0.1], strength: 1 },
  intense: { intensity: [0.64, 1], warp: [0.055, 0.14], strength: 1.32 },
} as const;
```

Generate a distinct speed subrange for every layer inside the normalized user bounds. Keep `velocityAt` positive and `advancePhaseTimes` continuously integrated. Add `interactionStrength` to `LabRecipe` and `PackedLabRecipe`; it changes collision/warp coefficients only.

- [ ] **Step 5: Add exact one-layer conversion**

`createSingleEffectRecipe(config)` copies study identity, shader data, colors, seed, scalar intensity, and transform defaults into one `LabLayer`; it sets constant `speed.min` and `speed.max` to `config.speed`, uses no interactions, and never calls the RNG.

- [ ] **Step 6: Run all core tests**

Run: `node --test tests/lab-core.test.mjs tests/card-core.test.mjs`

Expected: all tests PASS, including 1-layer recipes, active-pool filtering, bounded irregular velocity, and deterministic settings.

- [ ] **Step 7: Commit the constrained recipe core**

```bash
git add app/lab/lab-core.ts tests/lab-core.test.mjs
git commit -m "feat: add constrained random recipe settings"
```

### Task 4: Add versioned curation state and browser synchronization

**Files:**
- Create: `app/curation/curation-core.ts`
- Create: `app/curation/use-curation.ts`
- Create: `tests/curation-core.test.mjs`

**Interfaces:**
- Produces: `CurationState`, `ShowcaseEntry`, `EMPTY_CURATION_STATE`, `normalizeCurationState`, `parseCurationState`, `recipeFingerprint`, `addShowcaseEntry`, `removeShowcaseEntry`, `deleteStudy`, `serializeCurationState`, `useCuration`.
- Browser key: `CURATION_STORAGE_KEY = "spectra-curation-v1"`.

- [ ] **Step 1: Write failing pure-state tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createLabRecipe, DEFAULT_LAB_SETTINGS } from "../app/lab/lab-core.ts";
import {
  EMPTY_CURATION_STATE, addShowcaseEntry, deleteStudy, parseCurationState,
  recipeFingerprint, removeShowcaseEntry, serializeCurationState,
} from "../app/curation/curation-core.ts";

const recipe = createLabRecipe(DEFAULT_LAB_SETTINGS, 99);
assert.ok(recipe);

test("deletion is literal but does not mutate saved entries", () => {
  const added = addShowcaseEntry(EMPTY_CURATION_STATE, {
    id: "entry-1", createdAt: 10, source: "lab", recipe,
  });
  assert.equal(added.added, true);
  const deleted = deleteStudy(added.state, recipe.layers[0].studyId);
  assert.ok(deleted.deletedStudyIds.includes(recipe.layers[0].studyId));
  assert.equal(deleted.showcase.length, 1);
  assert.equal(removeShowcaseEntry(deleted, "entry-1").showcase.length, 0);
});

test("exact recipes deduplicate while changed recipes remain addable", () => {
  const first = addShowcaseEntry(EMPTY_CURATION_STATE, {
    id: "entry-1", createdAt: 10, source: "lab", recipe,
  });
  const duplicate = addShowcaseEntry(first.state, {
    id: "entry-2", createdAt: 20, source: "lab", recipe,
  });
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.state.showcase.length, 1);
  const changed = structuredClone(recipe);
  changed.seed += 1;
  assert.notEqual(recipeFingerprint(recipe), recipeFingerprint(changed));
});

test("malformed serialized state is rejected and valid state is normalized", () => {
  assert.equal(parseCurationState("{"), null);
  assert.equal(parseCurationState(JSON.stringify({ version: 2 })), null);
  const parsed = parseCurationState(JSON.stringify({
    version: 1, deletedStudyIds: [3, 3, -1, 999], showcase: [], extra: true,
  }));
  assert.deepEqual(parsed, { version: 1, deletedStudyIds: [3], showcase: [] });
  assert.deepEqual(Object.keys(JSON.parse(serializeCurationState(parsed))).sort(),
    ["deletedStudyIds", "showcase", "version"]);
});
```

- [ ] **Step 2: Run and verify the curation module is missing**

Run: `node --test tests/curation-core.test.mjs`

Expected: FAIL with module-not-found for `curation-core.ts`.

- [ ] **Step 3: Implement the pure version-1 state module**

Use these exact public types and constants:

```ts
export const CURATION_STORAGE_KEY = "spectra-curation-v1";
export const CURATION_EVENT = "spectra-curation-change";
export type ShowcaseEntry = {
  id: string;
  createdAt: number;
  source: "library" | "lab";
  recipe: LabRecipe;
};
export type CurationState = {
  version: 1;
  deletedStudyIds: number[];
  showcase: ShowcaseEntry[];
};
export const EMPTY_CURATION_STATE: CurationState = {
  version: 1, deletedStudyIds: [], showcase: [],
};
```

`normalizeCurationState` accepts only version 1, clamps deleted IDs to integer `0–143`, removes duplicate deleted IDs, validates every showcase entry and recipe shape, removes duplicate entry IDs, and sorts showcase entries by descending `createdAt`. `recipeFingerprint` serializes only recipe fields in a fixed property order. `addShowcaseEntry` rejects an existing fingerprint; the other mutations return new arrays and do not modify inputs. `serializeCurationState` emits only the three version-1 keys.

- [ ] **Step 4: Implement the client hook without side effects inside React state updaters**

`useCuration` keeps a `stateRef`, reads storage once after mount, and exposes:

```ts
type CurationController = {
  state: CurationState;
  hydrated: boolean;
  warning: string | null;
  add(source: "library" | "lab", recipe: LabRecipe): boolean;
  remove(entryId: string): void;
  deleteStudy(studyId: number): void;
  exportJson(): string;
};
```

The internal `commit(next)` validates first, updates the ref and React state, then writes storage and dispatches `CustomEvent(CURATION_EVENT, { detail: normalized })`. Catch storage errors and set `仅本次会话保存`. Listen for the custom event in the same document and `storage` in other tabs. When stored JSON is malformed, retain the last valid in-memory state, show `策展数据无法读取`, and do not write over the bad value.

`add(source, recipe)` constructs the entry with `crypto.randomUUID()` and `Date.now()`, checks `recipeFingerprint` before committing, and returns `false` without writing or dispatching when the exact recipe already exists.

- [ ] **Step 5: Run curation tests**

Run: `node --test tests/curation-core.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 6: Commit curation state**

```bash
git add app/curation/curation-core.ts app/curation/use-curation.ts tests/curation-core.test.mjs
git commit -m "feat: add local curation state"
```

### Task 5: Extract shared atomic rendering and build a multi-recipe atlas

**Files:**
- Create: `app/render/atomic-atlas.tsx`
- Create: `app/render/recipe-atlas.tsx`
- Create: `tests/atlas-renderers.test.mjs`
- Modify: `app/page.tsx`

**Interfaces:**
- `AtomicAtlas({ configs, playing, actions? })` renders up to 12 `CardConfig` items with one WebGL2 source atlas.
- `RecipeAtlas({ entries, playing, onRemove? })` renders up to 12 `ShowcaseEntry` recipes with one WebGL2 source atlas.
- Both expose visible 2D canvases and keep action controls outside `<article className="preview-card">`.

- [ ] **Step 1: Write source-level renderer contracts**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("each atlas owns one WebGL2 context and copies to visible canvases", async () => {
  for (const path of ["../app/render/atomic-atlas.tsx", "../app/render/recipe-atlas.tsx"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.equal((source.match(/getContext\("webgl2"/g) || []).length, 1);
    assert.match(source, /document\.createElement\("canvas"\)/);
    assert.match(source, /getContext\("2d"\)/);
    assert.match(source, /drawImage\(/);
    assert.match(source, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  }
});

test("recipe atlas packs six slots and advances independent clocks", async () => {
  const source = await readFile(new URL("../app/render/recipe-atlas.tsx", import.meta.url), "utf8");
  assert.match(source, /packLabRecipe\(/);
  assert.match(source, /advancePhaseTimes\(/);
  assert.match(source, /phaseTimesRef/);
  assert.match(source, /uniform1fv\(uniforms\.layerTimes/);
  assert.match(source, /LAB_FRAGMENT_SHADER/);
});
```

- [ ] **Step 2: Run and verify renderer files are missing**

Run: `node --test tests/atlas-renderers.test.mjs`

Expected: FAIL with file-not-found.

- [ ] **Step 3: Move the current homepage atlas into `AtomicAtlas`**

Move the existing compile/link, 2 × 6 viewport/scissor drawing, deferred resize, DPR cap, and 2D copy logic without changing shader uniforms. Replace direct `MOTION_STUDIES[config.studyId]` indexing with lookup by ID. Accept an `actions(config)` render callback after each card so library buttons remain outside the card.

- [ ] **Step 4: Implement `RecipeAtlas` with per-cell six-layer uploads**

Use `LAB_VERTEX_SHADER` and `LAB_FRAGMENT_SHADER`. Keep `phaseTimesRef` as `Map<entryId, Float32Array>` and elapsed time as `Map<entryId, number>`. During each cell draw, call `advancePhaseTimes(entry.recipe, phases, elapsed, delta)`, upload `packLabRecipe(entry.recipe)`, set `interactionStrength`, viewport/scissor the atlas cell, draw once, then copy the atlas cell to its visible 2D canvas. Upload static recipe arrays only when entries change by caching each entry fingerprint.

If WebGL fails, leave the CSS palette gradient visible and keep all buttons interactive.

- [ ] **Step 5: Reduce `app/page.tsx` to a temporary `RecipeAtlas` consumer**

Remove the embedded `AtlasGallery` definition. Render the curated empty state until Task 7 supplies entries. This prevents duplicate renderers and keeps every intermediate commit buildable.

- [ ] **Step 6: Run renderer, shader, and build tests**

Run: `node --test tests/atlas-renderers.test.mjs tests/lab-shader.test.mjs`

Expected: 5 tests PASS.

Run: `npm run build`

Expected: exit 0 and a successful Vinext production build.

- [ ] **Step 7: Commit both atlas renderers**

```bash
git add app/render/atomic-atlas.tsx app/render/recipe-atlas.tsx app/page.tsx tests/atlas-renderers.test.mjs
git commit -m "feat: add shared atomic and recipe atlases"
```

### Task 6: Build the 144-effect library route

**Files:**
- Create: `app/library/library-core.ts`
- Create: `app/library/page.tsx`
- Create: `tests/library-core.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `getActiveStudies(deletedStudyIds)` filters literal deletions.
- `getLibraryPage(studies, pageIndex)` compacts filtered studies into 12-item pages.
- The page consumes `AtomicAtlas`, `createSingleEffectRecipe`, and `useCuration`.

- [ ] **Step 1: Write library filtering and pagination tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getActiveStudies, getLibraryPage } from "../app/library/library-core.ts";

test("deleted studies disappear and pagination compacts", () => {
  const active = getActiveStudies([0, 5, 5, 143]);
  assert.equal(active.length, 142);
  assert.equal(active[0].id, 1);
  assert.equal(active[4].id, 6);
  assert.equal(getLibraryPage(active, 0).length, 12);
  assert.equal(getLibraryPage(active, 11).length, 10);
  assert.deepEqual(getLibraryPage(active, 12), []);
});
```

- [ ] **Step 2: Run and verify the library core is missing**

Run: `node --test tests/library-core.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement pure active-pool helpers**

Normalize the deleted set to valid integers and filter `MOTION_STUDIES` in stable ID order. Clamp negative page indices to page zero and return an empty array when the requested page begins beyond the active list.

- [ ] **Step 4: Build `/library` around the atomic atlas**

The page keeps `masterSeed`, `pageIndex`, `playing`, and `notice`. Derive all 144 configs with `createGallery(masterSeed)`, filter by active study IDs, then slice the compact page. Controls are `一键全部随机`, pause/play, and reset. Every visible item renders external metadata plus two buttons:

```tsx
<button onClick={() => addToHome(config)}>展示到首页</button>
<button className="danger-action" onClick={() => deleteStudy(config.studyId)}>
  删除
</button>
```

`addToHome` calls `createSingleEffectRecipe(config)` and reports either `已展示到首页` or `已在首页`. Deletion is immediate, has no confirmation dialog, adjusts `pageIndex` to the last remaining page, and never touches existing showcase entries. The empty state links to `/` and explains that the random lab has no available effects.

- [ ] **Step 5: Replace old homepage HTML expectations with library expectations**

Add a `/library` render test asserting: status 200; copy includes `一百四十四种单效果`; exactly 12 cards and 12 canvases on the first page; exactly 12 `展示到首页` actions and 12 `删除` actions; `01 · 柔雾扩散`; navigation links to `/` and `/lab`; both action types remain outside each card article.

- [ ] **Step 6: Run library and rendered HTML tests**

Run: `node --test tests/library-core.test.mjs`

Expected: PASS.

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: library HTML checks PASS; homepage checks reflect the temporary empty showcase.

- [ ] **Step 7: Commit the library route**

```bash
git add app/library/library-core.ts app/library/page.tsx tests/library-core.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: add curated atomic effect library"
```

### Task 7: Replace the homepage with the curated showcase

**Files:**
- Modify: `app/page.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `useCuration`, `RecipeAtlas`, `serializeCurationState`.
- Produces: empty-state homepage, 12-entry pagination, deletion, read-only recipe detail, and JSON download.

- [ ] **Step 1: Add failing homepage HTML assertions**

Assert server output contains `策展首页`, links to `/library` and `/lab`, `尚未添加动态作品`, and `导出策展配置`; assert it does not contain `一键全部随机` or the 144-study catalog grid.

- [ ] **Step 2: Run the rendered HTML test and verify copy is absent**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: FAIL on missing curated-home copy.

- [ ] **Step 3: Implement the local-first homepage**

After hydration, slice `state.showcase` by `pageIndex * 12`. When empty, show two primary destinations: `进入效果库` and `开始随机创作`. When populated, pass the 12 visible entries to `RecipeAtlas`, show source (`单效果` or `随机混合`), layer count, palette name, creation time, a read-only expandable recipe, and an external `从首页删除` button.

The page keeps play/pause, uses newest-first order from normalized state, clamps page index after removal, and announces all mutations via `aria-live`.

- [ ] **Step 4: Add exact normalized export**

Create a UTF-8 Blob from `exportJson()`, an object URL, and an `<a download="spectra-curation.json">`. Click it programmatically, revoke the URL, and report success. On failure, report `导出失败，策展内容未改变` and keep state untouched.

- [ ] **Step 5: Run homepage HTML and core tests**

Run: `npm run build && node --test tests/rendered-html.test.mjs tests/curation-core.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the curated homepage**

```bash
git add app/page.tsx tests/rendered-html.test.mjs
git commit -m "feat: add curated showcase homepage"
```

### Task 8: Connect the random lab to active studies and full constraints

**Files:**
- Modify: `app/lab/page.tsx`
- Modify: `app/lab/lab-preview.tsx`
- Modify: `app/lab/lab-shader.ts`
- Modify: `tests/lab-shader.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_LAB_SETTINGS`, `createLabRecipe`, active studies, `useCuration.add`.
- Produces: effect count, mix intensity, speed bounds, palette direction, randomize, pause, and add-to-home controls.

- [ ] **Step 1: Extend failing lab HTML and shader tests**

Assert `/lab` contains counts `1–6`, labels `混合强度`, `速度下限`, `速度上限`, `配色方向`, options `柔和`, `均衡`, `激烈`, and `展示到首页`. Assert the shader has `uniform float interactionStrength;` and applies it to seam, layer mask, and interaction warp without multiplying any speed profile.

- [ ] **Step 2: Run and verify missing controls and uniform fail**

Run: `npm run build && node --test tests/lab-shader.test.mjs tests/rendered-html.test.mjs`

Expected: FAIL on the new controls and uniform.

- [ ] **Step 3: Add the interaction-strength uniform**

Add `interactionStrength` to `LAB_FRAGMENT_SHADER`, upload it from `LabPreview`, and use it only in `interactLayers`, layer-mask contrast, and `interactionWarp`. Do not use it in `advancePhaseTimes`, `velocityAt`, or any time uniform.

- [ ] **Step 4: Build all four constraint groups**

Use buttons for effect count `1–6` and mix intensity. Use two labeled range inputs with bounds `0.1–2.6` and step `0.1`; updating one clamps it so `speedMin + 0.1 <= speedMax`. Use a native select for six palette directions. Setting changes update `LabSettings`; they generate a new recipe only after `一键随机创作`.

Derive active studies from `state.deletedStudyIds`. Disable randomization only when the pool is empty and show `效果库已无可用动态`. Preserve the current recipe if one was generated before its source was deleted.

- [ ] **Step 5: Add the current recipe to the homepage**

Call `useCuration.add("lab", recipe)` without regenerating. Report `已展示到首页` or `已在首页`. Keep the preview and recipe details unchanged after addition. Add navigation links to `/` and `/library`.

- [ ] **Step 6: Run lab and rendered HTML tests**

Run: `npm run build && node --test tests/lab-core.test.mjs tests/lab-shader.test.mjs tests/rendered-html.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the connected lab**

```bash
git add app/lab/page.tsx app/lab/lab-preview.tsx app/lab/lab-shader.ts tests/lab-shader.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: connect constrained lab to curation"
```

### Task 9: Finish visual states, documentation, and full verification

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: final responsive UI, accessible actions, updated Chinese project description, and one complete test command.

- [ ] **Step 1: Add failing CSS/accessibility source assertions**

Assert the CSS includes `.card-actions`, `.empty-showcase`, `.lab-settings`, `.pagination`, `.danger-action`, `min-height: 44px` for action buttons, two-column atlas at desktop, one column below 900px, card `25% 75%`, precise-pointer hover lift, and reduced-motion hover reset.

- [ ] **Step 2: Run the source test and verify new selectors are absent**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL on the first missing final-state selector.

- [ ] **Step 3: Style the three routes in the current SPECTRA FLUX language**

Keep the existing paper background, compact pixel-accent wordmark, sticky left rail, monospaced metadata, white pill cards, and restrained dark controls. Add external action rows, compact pagination, empty-state panel, settings grid, warning/status copy, touch-sized controls, and responsive collapse. Do not enlarge the current hero typography.

- [ ] **Step 4: Update metadata and Chinese README**

Set the description to `SPECTRA FLUX：144 种 WebGL 单效果、随机混合实验室与本地策展首页。`. Document the three routes, six new themes, literal deletion, local-only persistence, JSON export, 12-card atlas performance model, and local run commands. Keep the existing preview URL.

- [ ] **Step 5: Make `npm test` include every test file explicitly**

Set the script to build and run:

```json
"test": "npm run build && node --test tests/card-core.test.mjs tests/catalog-shader.test.mjs tests/motion-catalog.test.mjs tests/lab-core.test.mjs tests/lab-shader.test.mjs tests/curation-core.test.mjs tests/library-core.test.mjs tests/atlas-renderers.test.mjs tests/rendered-html.test.mjs"
```

- [ ] **Step 6: Run static verification**

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

Run: `npm test`

Expected: exit 0, production build succeeds, and every named Node test passes.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 7: Run browser behavior and performance verification**

Start: `npm run dev -- --port 3001`

Verify in a real browser:

1. `/` starts empty in a clean storage profile and shows library/lab links.
2. `/library` animates 12 cards smoothly with one WebGL context; randomization changes the current visible configuration.
3. Add a single effect, add it again to see `已在首页`, randomize, and add the changed version successfully.
4. Delete the source effect; it disappears from the compact library and future lab recipes but remains on `/`.
5. In `/lab`, generate and add 1-, 3-, and 6-layer recipes under all three intensity settings and two different speed ranges.
6. Confirm each layer accelerates and slows irregularly without reversal, phase reset, or a 1–2 second return to the same initial form.
7. Add 13 homepage entries; verify newest first, 12 on page one, one on page two, and one recipe-atlas WebGL context per page.
8. Remove a homepage entry and confirm the library is unchanged.
9. Reload every route and confirm local state persists; open a second tab and confirm storage-event synchronization.
10. Export `spectra-curation.json` and verify it contains only `version`, `deletedStudyIds`, and `showcase`.
11. Emulate reduced motion and confirm each route shows stable frames.
12. Check the console contains no WebGL, ResizeObserver, hydration, or React key errors.

- [ ] **Step 8: Commit final UI and documentation**

```bash
git add app/globals.css app/layout.tsx README.md package.json tests/rendered-html.test.mjs
git commit -m "feat: finish 144-effect curation studio"
```

- [ ] **Step 9: Record final branch evidence**

Run: `git status --short`

Expected: no output.

Run: `git log --oneline -9`

Expected: the nine feature commits from this plan appear above the existing random-lab commits.
