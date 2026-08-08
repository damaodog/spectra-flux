# Curated Motion Atlas V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the user's nine selected studies to the front of their chapters with new display numbers, preserve their original motion, and replace the other twenty-seven studies with newly named and visibly distinct veil, optical-material, and fluid-force effects.

**Architecture:** Keep the current React page, one WebGL2 program, one hidden `2 × 6` atlas, and twelve visible 2D canvases. Add `studyId` and `shaderVariant` so display order is independent from shader dispatch, then add a bounded set of reusable event fields selected by `kernel` and tuned through the existing `studyParams` uniform.

**Tech Stack:** TypeScript, React, WebGL2/GLSL ES 3.00, CSS, Node test runner, vinext.

## Global Constraints

- Keep all work local at `http://localhost:3000/`; do not publish or add hosting.
- Keep exactly 36 studies, three pages, 12 studies per page, and only 12 mounted canvases.
- Keep card size `400 × 100`, `25% / 75%` text-to-visual split, two desktop columns, one narrow-screen column, and labels outside cards.
- Keep one WebGL2 program and one hidden `2 × 6` atlas; do not add dependencies or per-card WebGL contexts.
- Preserve old studies `01, 03, 05, 11, 13, 22, 30, 32, 34` under their approved new numbers and original shader identities.
- Exclude particles, glitch, scanlines, hard geometric effects, export, recording, and per-card editors.

---

### Task 1: Separate display identity from shader identity and install the V2 catalog

**Files:**
- Modify: `app/motion-catalog.ts`
- Modify: `app/card-core.ts`
- Modify: `app/page.tsx`
- Test: `tests/card-core.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `MotionStudy.shaderVariant: number` and `CardConfig.studyId: number`.
- Produces: `createGallery(seed)` results whose `studyId` drives labels/keys and whose `variant` drives the shader.
- Preserves: `getMotionPage(pageIndex)` and `MOTION_PAGE_SIZE = 12`.

- [ ] **Step 1: Write failing catalog and mapping tests**

Replace the old selected-name assertion in `tests/card-core.test.mjs` with exact V2 order and preservation checks:

```js
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

test("the V2 catalog keeps the approved studies first in each chapter", () => {
  assert.deepEqual(MOTION_STUDIES.map(({ name }) => name), expectedV2Names);
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

test("gallery display identity is independent from shader identity", () => {
  const gallery = createGallery(2026);
  assert.deepEqual(gallery.map(({ studyId }) => studyId),
    Array.from({ length: 36 }, (_, index) => index));
  assert.deepEqual(gallery.slice(0, 4).map(({ variant }) => variant), [0, 2, 4, 10]);
  assert.deepEqual(gallery.slice(12, 14).map(({ variant }) => variant), [12, 21]);
  assert.deepEqual(gallery.slice(24, 27).map(({ variant }) => variant), [29, 31, 33]);
});
```

In the existing `createGallery returns thirty-six deterministic configured studies` test, replace the sequential-variant assertion with:

```js
assert.deepEqual(
  gallery.map((card) => card.studyId),
  Array.from({ length: 36 }, (_, index) => index),
);
assert.deepEqual(
  gallery.map((card) => card.variant),
  MOTION_STUDIES.map((study) => study.shaderVariant),
);
```

Add a rendered-source assertion in `tests/rendered-html.test.mjs`:

```js
assert.match(source, /const studyNumber = String\(config\.studyId \+ 1\)/);
assert.match(source, /const studyName = MOTION_STUDIES\[config\.studyId\]\.name/);
assert.match(source, /key=\{config\.studyId\}/);
```

Replace the first-page `studyMeta` fixture in `tests/rendered-html.test.mjs` with:

```js
const studyMeta = [
  "01 · 柔雾扩散",
  "02 · 横向薄纱",
  "03 · 斜向漂移",
  "04 · 急速奔流",
  "05 · 双向潮缝",
  "06 · 织带交叠",
  "07 · 剪切尾流",
  "08 · 云脊翻涌",
  "09 · 绸带塌缩",
  "10 · 丝线回声",
  "11 · 逆层卷吸",
  "12 · 雾幕呼吸",
];
```

- [ ] **Step 2: Run the targeted tests and confirm the expected failure**

Run:

```powershell
node --test --test-name-pattern="V2 catalog|display identity" tests/card-core.test.mjs
node --test --test-name-pattern="gallery shares" tests/rendered-html.test.mjs
```

Expected: FAIL because `shaderVariant` and `studyId` do not exist and the catalog is still in the old order.

- [ ] **Step 3: Replace the parallel catalog arrays with one explicit V2 catalog**

In `app/motion-catalog.ts`, add `shaderVariant` to `MotionStudy` and replace `names`, `kernels`, `speeds`, `params`, and their final mapping with:

```ts
export type MotionStudy = {
  id: number;
  name: string;
  chapter: 0 | 1 | 2;
  shaderVariant: number;
  kernel: number;
  speed: number | null;
  params: readonly [number, number, number, number];
};

const study = (
  id: number,
  name: string,
  shaderVariant: number,
  kernel: number,
  speed: number | null,
  params: readonly [number, number, number, number],
): MotionStudy => ({
  id,
  name,
  chapter: Math.floor(id / MOTION_PAGE_SIZE) as 0 | 1 | 2,
  shaderVariant,
  kernel,
  speed,
  params,
});

export const MOTION_STUDIES: readonly MotionStudy[] = [
  study(0, "柔雾扩散", 0, 0, null, [0, 0, 0, 0]),
  study(1, "横向薄纱", 2, 0, null, [0, 0, 0, 0]),
  study(2, "斜向漂移", 4, 0, null, [0, 0, 0, 0]),
  study(3, "急速奔流", 10, 0, 1.60, [0, 0, 0, 0]),
  study(4, "双向潮缝", 4, 13, 0.86, [0.92, 0.54, 0.34, 0.72]),
  study(5, "织带交叠", 5, 14, 0.74, [1.18, 0.46, 0.68, 0.52]),
  study(6, "剪切尾流", 6, 15, 1.18, [1.36, 0.34, 0.58, 0.76]),
  study(7, "云脊翻涌", 7, 16, 0.66, [0.82, 0.72, 0.44, 0.64]),
  study(8, "绸带塌缩", 8, 16, 0.54, [1.42, 0.38, 0.72, 0.48]),
  study(9, "丝线回声", 9, 14, 0.94, [1.56, 0.62, 0.38, 0.82]),
  study(10, "逆层卷吸", 10, 15, 0.82, [0.74, -0.68, 0.84, 0.58]),
  study(11, "雾幕呼吸", 11, 13, 0.42, [0.58, 0.86, 0.46, 0.94]),
  study(12, "油膜涌色", 12, 2, 0.64, [1.18, 0.74, 0.34, 0.62]),
  study(13, "柔焦色蚀", 21, 5, 0.48, [0.82, 0.68, 0.44, 0.78]),
  study(14, "焦散折叠", 14, 17, 0.72, [1.42, 0.56, 0.72, 0.48]),
  study(15, "玻璃对撞", 15, 18, 0.78, [0.88, 0.64, 0.54, 0.76]),
  study(16, "棱镜绽放", 16, 19, 0.84, [1.26, 0.42, 0.82, 0.58]),
  study(17, "珠光脉冲", 17, 17, 0.52, [0.68, 0.92, 0.46, 0.88]),
  study(18, "蛋白石裂隙", 18, 20, 0.58, [1.12, 0.74, 0.62, 0.54]),
  study(19, "虹彩虹吸", 19, 20, 0.88, [1.48, 0.38, 0.78, 0.72]),
  study(20, "折射泡沫", 20, 18, 0.66, [0.72, 1.12, 0.58, 0.64]),
  study(21, "发光膜面", 21, 19, 0.60, [0.94, 0.82, 0.44, 0.78]),
  study(22, "柔波干涉", 22, 21, 0.74, [1.18, 0.58, 0.86, 0.48]),
  study(23, "虹彩脉络", 23, 21, 1.02, [1.62, 0.46, 0.72, 0.84]),
  study(24, "液面干涉", 29, 10, 0.80, [1.28, 0.72, 0.54, 0.48]),
  study(25, "相位潮汐", 31, 10, 0.52, [0.68, 0.86, 1.24, 0.46]),
  study(26, "细胞融汇", 33, 9, 0.60, [0.82, 1.12, 0.68, 0.52]),
  study(27, "涡旋合并", 27, 22, 0.86, [1.16, 0.72, 0.58, 0.76]),
  study(28, "射流撞击", 28, 23, 1.12, [1.42, 0.44, 0.76, 0.68]),
  study(29, "冲击环", 29, 24, 0.78, [0.92, 0.68, 1.18, 0.54]),
  study(30, "逆流撕裂", 30, 23, 0.96, [1.28, -0.62, 0.58, 0.82]),
  study(31, "黏性坍缩", 31, 25, 0.62, [0.74, 1.26, 0.68, 0.48]),
  study(32, "边界卷起", 32, 22, 1.04, [1.54, 0.52, 0.82, 0.72]),
  study(33, "密度呼吸", 33, 24, 0.44, [0.58, 0.86, 0.48, 0.94]),
  study(34, "潮汐剪切", 34, 26, 0.82, [1.12, 0.74, 0.62, 0.56]),
  study(35, "湍流编织", 35, 26, 1.28, [1.68, 0.46, 0.84, 0.78]),
];
```

Keep `getMotionPage` unchanged below this catalog.

- [ ] **Step 4: Route labels and shader dispatch through their separate identities**

Add `studyId` to `CardConfig` in `app/card-core.ts`, then change `createGallery` to:

```ts
export function createGallery(seed: number) {
  return MOTION_STUDIES.map((motionStudy) => {
    const cardSeed = (seed + Math.imul(motionStudy.id + 1, 0x9e3779b1)) >>> 0;
    const preset = createPreset(cardSeed);
    return {
      ...preset,
      speed: motionStudy.speed ?? preset.speed,
      seed: cardSeed,
      studyId: motionStudy.id,
      variant: motionStudy.shaderVariant,
      kernel: motionStudy.kernel,
      params: motionStudy.params,
    };
  });
}
```

Add `studyId` to every direct `CardConfig` fixture in `tests/card-core.test.mjs`. In `app/page.tsx`, replace the label lookup block with:

```tsx
const studyNumber = String(config.studyId + 1).padStart(2, "0");
const studyName = MOTION_STUDIES[config.studyId].name;

return (
  <div className="card-study" key={config.studyId}>
```

In `makeCards`, build `label` from `visual.studyId` instead of the map index:

```ts
label: `STYLE ${String(visual.studyId + 1).padStart(2, "0")} · ${MOTION_STUDIES[visual.studyId].name}`,
```

- [ ] **Step 5: Run the core and rendered-source tests**

Run:

```powershell
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
```

Expected: all catalog, identity, pagination, and source tests PASS.

- [ ] **Step 6: Commit the identity and catalog change**

```powershell
git add app/motion-catalog.ts app/card-core.ts app/page.tsx tests/card-core.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: curate motion atlas v2 catalog"
```

---

### Task 2: Add the eight new mist-and-veil studies

**Files:**
- Modify: `app/card-core.ts`
- Test: `tests/card-core.test.mjs`

**Interfaces:**
- Consumes: kernels `13–16` and `studyParams` from the V2 catalog.
- Produces: `seamField`, `braidField`, `wakeField`, and `foldField` GLSL helpers.

- [ ] **Step 1: Write a failing shader-structure test**

```js
test("the V2 veil chapter exposes seam braid wake and fold fields", () => {
  ["seamField", "braidField", "wakeField", "foldField"].forEach((name) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`));
  });
  assert.match(FRAGMENT_SHADER, /if\(kernel == 13\) materialFields = seamField/);
  assert.match(FRAGMENT_SHADER, /if\(kernel == 14\) materialFields = braidField/);
  assert.match(FRAGMENT_SHADER, /if\(kernel == 15\) materialFields = wakeField/);
  assert.match(FRAGMENT_SHADER, /if\(kernel == 16\) materialFields = foldField/);
});
```

- [ ] **Step 2: Run the test and confirm it fails on the missing helpers**

```powershell
node --test --test-name-pattern="V2 veil chapter" tests/card-core.test.mjs
```

Expected: FAIL because `seamField` is absent.

- [ ] **Step 3: Add a narrow-line helper and the four veil event fields**

Insert after `band` in `FRAGMENT_SHADER`:

```glsl
float softLine(float value, float width, float feather){
  return 1.0 - smoothstep(width, width + feather, abs(value));
}

vec4 seamField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.72, 3.2 + q.x) + vec2(t * 0.08, -t * 0.04));
  float seam = p.y - sin(p.x * (1.0 + q.x) - t * 0.14) * 0.16 - (n - 0.5) * 0.28;
  float pulse = 0.5 + 0.5 * sin(t * (0.10 + q.w * 0.08));
  float upper = softLine(seam - mix(0.30, 0.10, pulse), 0.11, 0.22);
  float lower = softLine(seam + mix(0.28, 0.08, pulse), 0.11, 0.22);
  float collision = softLine(seam, 0.035, 0.08);
  return vec4(upper, lower, collision, collision * (0.45 + 0.55 * n));
}

vec4 braidField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.82, 3.8) + vec2(t * 0.09, -t * 0.04));
  float a = p.y - sin(p.x * (1.2 + q.x) - t * 0.16) * 0.22 - (n - 0.5) * 0.18;
  float b = p.y - sin(p.x * (1.7 + q.y) + t * 0.11 + 2.1) * 0.20 + (n - 0.5) * 0.16;
  float c = p.y - sin(p.x * (2.1 + q.z) - t * 0.08 + 4.2) * 0.15;
  return vec4(softLine(a, 0.08, 0.18), softLine(b, 0.08, 0.18), softLine(c, 0.045, 0.10), softLine(a - b, 0.04, 0.10));
}

vec4 wakeField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.64, 4.2) + vec2(t * 0.16, -t * 0.06));
  float coreLine = p.y - sin(p.x * (1.4 + q.x) - t * 0.28) * 0.13 - (n - 0.5) * 0.16;
  float direction = sign(q.y == 0.0 ? 1.0 : q.y);
  float upperWake = coreLine - 0.20 - direction * sin(p.x * 2.2 - t * 0.11) * 0.10;
  float lowerWake = coreLine + 0.22 + direction * sin(p.x * 1.8 + t * 0.09) * 0.09;
  return vec4(softLine(coreLine, 0.05, 0.11), softLine(upperWake, 0.10, 0.20), softLine(lowerWake, 0.10, 0.20), softLine(upperWake + lowerWake, 0.05, 0.13));
}

vec4 foldField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.70, 3.0 + q.y) + vec2(t * 0.07, -t * 0.05));
  float breath = 0.5 + 0.5 * sin(t * (0.07 + q.w * 0.05));
  float fold = p.y - sin(p.x * (1.0 + q.x) - t * 0.12) * mix(0.30, 0.12, breath) - (n - 0.5) * 0.24;
  float crest = softLine(fold, 0.035, 0.08);
  float face = softLine(fold - mix(0.34, 0.12, breath), 0.14, 0.24);
  float returnFace = softLine(fold + mix(0.30, 0.10, breath), 0.12, 0.22);
  return vec4(face, returnFace, crest, max(face, returnFace) * (0.42 + n * 0.58));
}
```

Add dispatch immediately after the existing kernel dispatch block:

```glsl
if(kernel == 13) materialFields = seamField(p, flowTime, studyParams);
if(kernel == 14) materialFields = braidField(p, flowTime, studyParams);
if(kernel == 15) materialFields = wakeField(p, flowTime, studyParams);
if(kernel == 16) materialFields = foldField(p, flowTime, studyParams);
```

- [ ] **Step 4: Expand the embed kernel clamp and run tests**

Change the current embed clamp to:

```ts
const kernelValue = Math.trunc(clamp(config.kernel, 0, 26));
```

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: all core tests PASS.

- [ ] **Step 5: Commit the veil fields**

```powershell
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add v2 veil motion fields"
```

---

### Task 3: Add the ten-study optical-material chapter

**Files:**
- Modify: `app/card-core.ts`
- Test: `tests/card-core.test.mjs`

**Interfaces:**
- Consumes: preserved kernels `2` and `5`; new kernels `17–21`.
- Produces: `causticFoldField`, `glassCollisionField`, `prismMembraneField`, `opalChannelField`, and `veinField`.

- [ ] **Step 1: Write the failing optical-field test**

```js
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
```

- [ ] **Step 2: Run the test and confirm the expected failure**

```powershell
node --test --test-name-pattern="V2 optical chapter" tests/card-core.test.mjs
```

Expected: FAIL because `causticFoldField` is absent.

- [ ] **Step 3: Add the five optical fields**

Insert before `void main` in `FRAGMENT_SHADER`:

```glsl
vec4 causticFoldField(vec2 p, float t, vec4 q){
  float haze = fbm(p * vec2(0.74, 2.8) + vec2(t * 0.05, -t * 0.03));
  float center = p.y - sin(p.x * (1.2 + q.x) - t * 0.12) * 0.18 - (haze - 0.5) * 0.22;
  float foldA = softLine(center + sin(p.x * 2.4 + t * 0.08) * 0.09, 0.025, 0.055);
  float foldB = softLine(center - 0.20 - cos(p.x * 1.8 - t * 0.10) * 0.08, 0.035, 0.070);
  float body = softLine(center, 0.20, 0.28);
  float pulse = 0.5 + 0.5 * sin(t * (0.08 + q.w * 0.05));
  return vec4(body, body * (0.45 + haze * 0.55), max(foldA, foldB), pulse * body);
}

vec4 glassCollisionField(vec2 p, float t, vec4 q){
  float approach = 0.54 - (0.5 + 0.5 * sin(t * 0.10)) * 0.34;
  vec2 leftCenter = vec2(-approach, sin(t * 0.07) * 0.10);
  vec2 rightCenter = vec2(approach, -sin(t * 0.08) * 0.10);
  float leftDistance = length((p - leftCenter) * vec2(0.64, 1.0));
  float rightDistance = length((p - rightCenter) * vec2(0.64, 1.0));
  float leftBody = 1.0 - smoothstep(0.28, 0.78, leftDistance);
  float rightBody = 1.0 - smoothstep(0.28, 0.78, rightDistance);
  float rim = max(softLine(leftDistance - 0.52, 0.02, 0.07), softLine(rightDistance - 0.52, 0.02, 0.07));
  float contact = softLine(leftDistance - rightDistance, 0.025, 0.08) * max(leftBody, rightBody);
  return vec4(leftBody, rightBody, rim, contact);
}

vec4 prismMembraneField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.76, 3.4) + vec2(t * 0.06, -t * 0.04));
  float membrane = p.y - sin(p.x * (1.1 + q.x) - t * 0.14) * 0.22 - (n - 0.5) * 0.18;
  float crest = softLine(membrane, 0.025, 0.055);
  float upper = softLine(membrane - 0.16, 0.10, 0.18);
  float lower = softLine(membrane + 0.18, 0.11, 0.20);
  float dispersion = crest * (0.5 + 0.5 * sin(p.x * (3.0 + q.z) - t * 0.20));
  return vec4(upper, lower, crest, dispersion);
}

vec4 opalChannelField(vec2 p, float t, vec4 q){
  float a = fbm(p * (1.2 + q.x * 0.4) + vec2(t * 0.06, -t * 0.04));
  float b = fbm(p.yx * (1.8 + q.y * 0.3) + vec2(-t * 0.05, t * 0.07) + 8.0);
  float boundary = a - b;
  float fissure = softLine(boundary, 0.025, 0.07);
  float channel = softLine(p.y - sin(p.x * (1.4 + q.z) - t * 0.18) * 0.18 - boundary * 0.22, 0.045, 0.10);
  return vec4(smoothstep(0.30, 0.72, a), smoothstep(0.30, 0.72, b), fissure, channel);
}

vec4 veinField(vec2 p, float t, vec4 q){
  float n1 = fbm(p * vec2(0.82, 3.8 + q.x) + vec2(t * 0.12, -t * 0.05));
  float n2 = fbm(p.yx * vec2(2.6, 0.72) + vec2(-t * 0.08, t * 0.04) + 6.0);
  float branchA = softLine(sin((p.y + (n1 - 0.5) * 0.42) * (5.0 + q.z) + p.x * 1.4 - t * 0.22), 0.06, 0.16);
  float branchB = softLine(sin((p.y - (n2 - 0.5) * 0.38) * (6.0 + q.y) - p.x * 1.1 + t * 0.17), 0.06, 0.16);
  float cells = 1.0 - smoothstep(0.08, 0.48, abs(n1 - n2));
  return vec4(n1, n2, max(branchA, branchB), cells * min(branchA + branchB, 1.0));
}
```

Add dispatch:

```glsl
if(kernel == 17) materialFields = causticFoldField(p, flowTime, studyParams);
if(kernel == 18) materialFields = glassCollisionField(p, flowTime, studyParams);
if(kernel == 19) materialFields = prismMembraneField(p, flowTime, studyParams);
if(kernel == 20) materialFields = opalChannelField(p, flowTime, studyParams);
if(kernel == 21) materialFields = veinField(p, flowTime, studyParams);
```

Expand the optical finishing branch from `kernel <= 6` to include V2 optical kernels without affecting force kernels:

```glsl
bool opticalKernel = (kernel >= 2 && kernel <= 6) || (kernel >= 17 && kernel <= 21);
if(opticalKernel){
  float opticalEdge = smoothstep(0.42, 0.94, materialFields.z);
  vec3 spectral = mix(colorA, colorB, 0.5 + 0.5 * sin((p.x + p.y) * 1.8 + flowTime * 0.12));
  color = mix(color, spectral, opticalEdge * 0.22);
  color = mix(color, vec3(1.0), materialFields.w * opticalEdge * 0.16);
}
```

- [ ] **Step 4: Run tests and commit the optical fields**

```powershell
node --test tests/card-core.test.mjs
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add v2 optical material fields"
```

Expected: all core tests PASS before the commit.

---

### Task 4: Add the nine-study fluid-force chapter

**Files:**
- Modify: `app/card-core.ts`
- Test: `tests/card-core.test.mjs`

**Interfaces:**
- Consumes: preserved kernels `9` and `10`; new kernels `22–26`.
- Produces: `vortexMergeField`, `jetCollisionField`, `shockField`, `collapseField`, and `shearBraidField`.

- [ ] **Step 1: Write the failing force-field test**

```js
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
```

- [ ] **Step 2: Run the test and confirm the expected failure**

```powershell
node --test --test-name-pattern="V2 force chapter" tests/card-core.test.mjs
```

Expected: FAIL because `vortexMergeField` is absent.

- [ ] **Step 3: Add the five force-event fields**

Insert before `void main`:

```glsl
vec4 vortexMergeField(vec2 p, float t, vec4 q){
  float approach = 0.62 - (0.5 + 0.5 * sin(t * 0.08)) * 0.36;
  vec2 left = p - vec2(-approach, 0.10);
  vec2 right = p - vec2(approach, -0.10);
  float leftRadius = length(left * vec2(0.66, 1.0));
  float rightRadius = length(right * vec2(0.66, 1.0));
  float leftSpin = 0.5 + 0.5 * sin(leftRadius * (8.0 + q.x * 2.0) + atan(left.y, left.x) * 2.0 - t * 0.30);
  float rightSpin = 0.5 + 0.5 * sin(rightRadius * (8.0 + q.z * 2.0) - atan(right.y, right.x) * 2.0 - t * 0.26);
  float leftMass = 1.0 - smoothstep(0.34, 0.92, leftRadius);
  float rightMass = 1.0 - smoothstep(0.34, 0.92, rightRadius);
  return vec4(leftMass * leftSpin, rightMass * rightSpin, min(leftMass, rightMass), softLine(leftRadius - rightRadius, 0.03, 0.10));
}

vec4 jetCollisionField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.82, 4.0) + vec2(t * 0.13, -t * 0.06));
  float seam = p.y - sin(p.x * (1.2 + q.x) - t * 0.18) * 0.15 - (n - 0.5) * 0.18;
  float leftJet = softLine(seam - p.x * 0.13, 0.055, 0.13) * (1.0 - smoothstep(-0.18, 0.76, p.x));
  float rightJet = softLine(seam + p.x * 0.13, 0.055, 0.13) * smoothstep(-0.76, 0.18, p.x);
  float impact = softLine(p.x + sin(t * 0.09) * 0.16, 0.05, 0.14) * softLine(seam, 0.10, 0.22);
  float tear = softLine(seam + sin(p.x * 2.4 + t * 0.13) * 0.11, 0.03, 0.08);
  return vec4(leftJet, rightJet, impact, tear);
}

vec4 shockField(vec2 p, float t, vec4 q){
  vec2 center = vec2(sin(t * 0.07) * 0.34, cos(t * 0.06) * 0.10);
  float radius = length((p - center) * vec2(0.62, 1.0));
  float cycle = 0.28 + fract(t * (0.035 + q.w * 0.02)) * 0.78;
  float ring = softLine(radius - cycle, 0.025, 0.08);
  float core = 1.0 - smoothstep(0.16, 0.62, radius);
  float fog = fbm(p * vec2(0.90, 2.8) + vec2(t * 0.05, -t * 0.03));
  float pressure = softLine(radius - cycle * 0.68 - (fog - 0.5) * 0.10, 0.05, 0.12);
  return vec4(core, pressure, ring, ring * (0.45 + fog * 0.55));
}

vec4 collapseField(vec2 p, float t, vec4 q){
  float pulse = 0.5 + 0.5 * sin(t * (0.07 + q.w * 0.04));
  vec2 scale = vec2(mix(0.48, 1.18, pulse), mix(1.28, 0.68, pulse));
  float n = fbm(p * vec2(0.76, 3.0) + vec2(t * 0.06, -t * 0.04));
  float mass = 1.0 - smoothstep(0.28, 1.02, length((p + vec2((n - 0.5) * 0.18, 0.0)) * scale));
  float core = 1.0 - smoothstep(0.10, 0.46, length(p * scale));
  float lateral = softLine(p.y - (n - 0.5) * 0.20, 0.09, 0.20) * pulse;
  return vec4(mass, core, lateral, min(mass, core + lateral));
}

vec4 shearBraidField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.72, 4.4) + vec2(t * 0.14, -t * 0.07));
  float upper = p.y - 0.18 - sin(p.x * (1.5 + q.x) - t * 0.22) * 0.16 - (n - 0.5) * 0.16;
  float lower = p.y + 0.18 - sin(p.x * (1.9 + q.z) + t * 0.17) * 0.15 + (n - 0.5) * 0.14;
  float filament = sin((p.y + (n - 0.5) * 0.44) * (8.0 + q.x * 2.0) + p.x * 1.4 - t * 0.34);
  return vec4(softLine(upper, 0.10, 0.19), softLine(lower, 0.10, 0.19), softLine(upper - lower, 0.035, 0.09), softLine(filament, 0.05, 0.14));
}
```

Add dispatch:

```glsl
if(kernel == 22) materialFields = vortexMergeField(p, flowTime, studyParams);
if(kernel == 23) materialFields = jetCollisionField(p, flowTime, studyParams);
if(kernel == 24) materialFields = shockField(p, flowTime, studyParams);
if(kernel == 25) materialFields = collapseField(p, flowTime, studyParams);
if(kernel == 26) materialFields = shearBraidField(p, flowTime, studyParams);
```

Replace the broad force finishing condition with:

```glsl
bool forceKernel = (kernel >= 7 && kernel <= 12) || kernel >= 22;
if(forceKernel){
  float forceOverlap = min(materialFields.x, materialFields.y);
  vec3 denseInk = clamp(mix(colorA, colorB, materialFields.y) * 0.82, 0.0, 1.0);
  color = mix(color, denseInk, forceOverlap * (0.16 + intensity * 0.16));
}
```

- [ ] **Step 4: Run tests and commit the force fields**

```powershell
node --test tests/card-core.test.mjs
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add v2 fluid force fields"
```

Expected: all core tests PASS before the commit.

---

### Task 5: Verify all pages, controls, motion, and performance safeguards

**Files:**
- Modify only if verification exposes a regression: `app/card-core.ts`, `app/page.tsx`, or `app/globals.css`
- Test: `tests/card-core.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Verifies: catalog order, selected-study preservation, one-context atlas, twelve active canvases, controls, layout, and animation state.

- [ ] **Step 1: Build and run the full automated suite**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git diff --check
```

Expected: build exits `0`, all tests pass with `0` failures, and `git diff --check` emits no errors.

- [ ] **Step 2: Verify the three page catalogs in the local browser**

At `http://localhost:3000/`, check these exact first/last labels and counts:

```text
Page 1: 01 · 柔雾扩散 / 12 · 雾幕呼吸 / 12 articles / 12 canvases
Page 2: 13 · 油膜涌色 / 24 · 虹彩脉络 / 12 articles / 12 canvases
Page 3: 25 · 液面干涉 / 36 · 湍流编织 / 12 articles / 12 canvases
```

Capture a full-page screenshot of each page and check that no new study is a uniform two-color fill.

- [ ] **Step 3: Verify controls and animation with pixel evidence**

For one visible card on each page:

```text
Playing: screenshots 700 ms apart differ.
Paused: screenshots 700 ms apart are byte-identical.
Resumed: screenshots 700 ms apart differ again.
Random: first card style attributes change and status contains “三十六款已全部随机”.
Reset: active page becomes “01–12 雾与薄纱” and first label becomes “01 · 柔雾扩散”.
```

Confirm there is no `UNHANDLED SCRIPT ERROR`, WebGL fallback, or resize error overlay.

- [ ] **Step 4: Verify final layout and repository state**

In the desktop browser, assert:

```text
article size: 400 × 100
gallery columns: 400px 400px
mounted canvas count: 12
```

Then run:

```powershell
git status --short
git log -6 --oneline
```

Expected: only intentional verification fixes are uncommitted; otherwise the worktree is clean.

- [ ] **Step 5: Commit any verification fix and rerun the final gate**

If browser verification required a source correction, first add a failing regression test, implement the smallest correction, then commit:

```powershell
git add app/card-core.ts app/page.tsx app/globals.css tests/card-core.test.mjs tests/rendered-html.test.mjs
git commit -m "fix: refine v2 motion readability"
```

Whether a correction was needed or not, rerun:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git diff --check
git status --short
```

Expected: build exits `0`, all tests pass, diff check is clean, and the worktree has no uncommitted files.
