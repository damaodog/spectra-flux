# Thirty-Six Motion Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local three-page gallery of thirty-six named WebGL motion studies, twelve cards per page, while preserving studies 01, 03, 05, and 11.

**Architecture:** A motion catalog owns the thirty-six stable identities, page slicing, kernel numbers, speeds, and tuning parameters. `card-core.ts` generates deterministic configs and renders a bounded set of shared shader kernels. `page.tsx` stores all thirty-six configs but mounts only the active twelve in the existing single-context `2 × 6` atlas.

**Tech Stack:** React, TypeScript, WebGL2/GLSL ES 3.00, CSS Grid, Node test runner, vinext.

## Global Constraints

- Preserve the current shader behavior, speed, identity, and numbering of 01, 03, 05, and 11.
- Show exactly twelve `400 × 100` cards per page.
- Use one WebGL2 context and a `2 × 6` atlas with a `1.5` DPR ceiling.
- Keep labels outside cards; card copy remains only `SPECTRA` and `COLOR AS A LIVING SYSTEM.`
- Randomization updates all thirty-six palettes, seeds, and fine variation without changing identity.
- Exclude particles, glitch, scanlines, and hard geometric effects.
- Remain local-only at `http://localhost:3000/`; do not add export or hosting.

---

### Task 1: Motion catalog and page slicing

**Files:**
- Create: `app/motion-catalog.ts`
- Modify: `app/card-core.ts`
- Modify: `tests/card-core.test.mjs`

**Interfaces:**
- Produces: `MOTION_PAGE_SIZE`, `MOTION_STUDIES`, `MotionStudy`, `getMotionPage(pageIndex)`.
- `MotionStudy` contains `id`, `name`, `chapter`, `kernel`, `speed`, and four `params`.
- `createGallery(seed)` consumes `MOTION_STUDIES` and returns thirty-six deterministic configs with `variant`, `kernel`, and `params`.

- [ ] **Step 1: Write failing catalog tests**

```js
import {
  MOTION_PAGE_SIZE,
  MOTION_STUDIES,
  getMotionPage,
} from "../app/motion-catalog.ts";

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
  assert.deepEqual(getMotionPage(0).map(({ id }) => id), Array.from({length: 12}, (_, i) => i));
  assert.deepEqual(getMotionPage(1).map(({ id }) => id), Array.from({length: 12}, (_, i) => i + 12));
  assert.deepEqual(getMotionPage(2).map(({ id }) => id), Array.from({length: 12}, (_, i) => i + 24));
  assert.deepEqual(getMotionPage(99), []);
});
```

Replace the twelve-item gallery assertion with:

```js
test("createGallery returns thirty-six deterministic configured studies", () => {
  const gallery = createGallery(2026);
  assert.equal(gallery.length, 36);
  assert.deepEqual(gallery.map(({ variant }) => variant), Array.from({length: 36}, (_, i) => i));
  assert.equal(new Set(gallery.map(({ seed }) => seed)).size, 36);
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
```

- [ ] **Step 2: Run tests and verify red**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because `app/motion-catalog.ts` and the thirty-six definitions do not exist.

- [ ] **Step 3: Create the complete catalog**

Create `app/motion-catalog.ts` with this public shape and exact ordered values:

```ts
export const MOTION_PAGE_SIZE = 12;

export type MotionStudy = {
  id: number;
  name: string;
  chapter: 0 | 1 | 2;
  kernel: number;
  speed: number | null;
  params: readonly [number, number, number, number];
};

const names = [
  "柔雾扩散", "薄纱碰撞", "横向薄纱", "薄纱断层",
  "斜向漂移", "丝流拉伸", "双层回流", "绸带折返",
  "墨丝破浪", "层云错位", "急速奔流", "慢纱呼吸",
  "油膜涌色", "液态折射", "珠光流变", "玻璃焦散",
  "极光薄层", "色散棱镜", "乳浊晕光", "云母闪流",
  "偏振波纹", "柔焦色蚀", "透明胶质", "光雾虹吸",
  "磁流体脉冲", "涡环撞击", "张力裂隙", "双场吞吐",
  "密度坍缩", "液面干涉", "环形扩散", "相位潮汐",
  "逆向卷吸", "细胞融汇", "纤维风暴", "深海呼吸",
] as const;

const kernels = [0,1,0,1,0,1,1,1,1,1,0,1, 2,3,2,4,4,3,4,2,5,5,6,3, 7,8,9,11,7,10,8,10,8,9,12,11] as const;
const speeds = [null,1.05,null,0.72,null,1.18,0.78,0.70,1.36,0.62,1.60,0.40, 0.64,0.72,0.58,0.66,0.52,0.76,0.44,0.56,0.68,0.48,0.54,0.82, 0.76,0.92,0.62,0.58,0.72,0.80,0.66,0.52,0.88,0.60,1.28,0.38] as const;
const params = [
  [0,0,0,0],[0.92,0.48,0.22,0.74],[0,0,0,0],[1.34,0.28,0.56,0.42],
  [0,0,0,0],[1.72,0.18,0.40,0.66],[0.78,-0.72,0.46,0.58],[1.08,0.62,0.72,0.38],
  [1.62,0.34,0.30,0.82],[0.64,0.24,0.86,0.48],[0,0,0,0],[0.52,0.18,0.44,0.92],
  [1.18,0.74,0.34,0.62],[0.86,0.52,0.76,0.44],[0.76,0.88,0.42,0.58],[1.42,0.38,0.66,0.48],
  [0.72,1.18,0.46,0.64],[1.24,0.68,0.82,0.54],[0.58,0.72,1.08,0.38],[1.52,0.44,0.58,0.76],
  [1.18,0.56,0.72,0.42],[0.82,0.68,0.44,0.78],[0.66,0.74,1.22,0.52],[1.36,0.46,0.64,0.84],
  [1.46,0.52,0.74,0.66],[1.12,0.84,0.48,0.78],[0.76,1.24,0.58,0.42],[0.88,0.62,1.18,0.54],
  [1.54,0.44,0.82,0.62],[1.28,0.72,0.54,0.48],[0.92,1.18,0.62,0.74],[0.68,0.86,1.24,0.46],
  [1.36,-0.58,0.72,0.64],[0.82,1.12,0.68,0.52],[1.62,0.78,0.46,0.84],[0.54,0.48,1.28,0.38],
] as const;

export const MOTION_STUDIES: readonly MotionStudy[] = names.map((name, id) => ({
  id,
  name,
  chapter: Math.floor(id / MOTION_PAGE_SIZE) as 0 | 1 | 2,
  kernel: kernels[id],
  speed: speeds[id],
  params: params[id],
}));

export const getMotionPage = (pageIndex: number) =>
  pageIndex >= 0 && pageIndex < 3
    ? MOTION_STUDIES.slice(pageIndex * MOTION_PAGE_SIZE, (pageIndex + 1) * MOTION_PAGE_SIZE)
    : [];
```

Update `CardConfig` with `kernel: number` and `params: readonly [number, number, number, number]`, set `SMOKE_VARIANT_COUNT = MOTION_STUDIES.length`, and map catalog values in `createGallery()`. Use `study.speed ?? preset.speed` so preserved studies 01, 03, and 05 retain their existing seeded speed behavior; study 11 retains its existing fixed `1.6` speed. Add `kernel: 0` and `params: [0, 0, 0, 0]` to existing test fixtures that construct `CardConfig` directly.

- [ ] **Step 4: Run core tests and verify green**

Run: `node --test tests/card-core.test.mjs`

Expected: all core tests PASS.

- [ ] **Step 5: Commit the catalog**

```bash
git add app/motion-catalog.ts app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add thirty-six motion study catalog"
```

### Task 2: Shared WebGL motion kernels

**Files:**
- Modify: `app/card-core.ts`
- Modify: `app/page.tsx`
- Modify: `tests/card-core.test.mjs`

**Interfaces:**
- Consumes: `CardConfig.kernel` and `CardConfig.params` from Task 1.
- Produces: GLSL uniforms `kernel` and `studyParams`, and thirteen stable kernel identities numbered `0–12`.
- Kernel `0` uses the preserved legacy branches for variants 0, 2, 4, and 10.

- [ ] **Step 1: Add failing shader-structure tests**

```js
test("the shader exposes bounded material kernels", () => {
  assert.match(FRAGMENT_SHADER, /uniform int kernel;/);
  assert.match(FRAGMENT_SHADER, /uniform vec4 studyParams;/);
  ["veilField", "filmField", "lensField", "glowField", "waveField", "gelField",
   "magnetField", "ringField", "tensionField", "interferenceField", "forceField", "filamentField"]
    .forEach((name) => assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`)));
  assert.doesNotMatch(FRAGMENT_SHADER, /sampler2D|framebuffer|particles|glitch|scanline/i);
});
```

Add a `buildEmbed` config containing `kernel: 2` and `params: [1.18, 0.74, 0.34, 0.62]`, then assert:

```js
assert.match(html, /uniform1i\(kernel,2\)/);
assert.match(html, /uniform4f\(studyParams,1\.18,0\.74,0\.34,0\.62\)/);
```

- [ ] **Step 2: Run tests and verify red**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because the uniforms and kernel functions are absent.

- [ ] **Step 3: Add the bounded shader kernels**

Add `uniform int kernel;` and `uniform vec4 studyParams;`. Add the following bounded field functions after the existing noise helpers. Each function returns four soft `0..1` fields and creates its identity through geometry, not palette changes:

```glsl
float band(float value, float width){
  return 1.0 - smoothstep(width, width + 0.34, abs(value));
}

vec4 veilField(vec2 p, float t, vec4 q){
  float n1 = fbm(p * vec2(0.72, 3.2 + q.x) + vec2(t * 0.10, -t * 0.05));
  float n2 = fbm(p * vec2(0.94, 4.4 + q.z) + vec2(-t * 0.08, t * 0.04) + 7.0);
  float top = p.y - 0.24 - (n1 - 0.5) * (0.28 + q.y * 0.18);
  float bottom = p.y + 0.22 - (n2 - 0.5) * (0.30 + abs(q.y) * 0.16);
  return clamp(vec4(band(top, 0.20), band(bottom, 0.22), band(top + bottom, 0.18), band(top - bottom, 0.28)), 0.0, 1.0);
}

vec4 filmField(vec2 p, float t, vec4 q){
  float a = fbm(p * (1.4 + q.x * 0.5) + vec2(t * 0.07, -t * 0.04));
  float b = fbm(p.yx * (2.0 + q.y * 0.4) + vec2(-t * 0.05, t * 0.06) + 9.0);
  float edge = 1.0 - smoothstep(0.08, 0.42, abs(a - b));
  return vec4(a, b, edge, smoothstep(0.32, 0.82, a + b - 0.38));
}

vec4 lensField(vec2 p, float t, vec4 q){
  vec2 c1 = vec2(sin(t * 0.11), cos(t * 0.09)) * vec2(0.46, 0.20);
  vec2 c2 = vec2(cos(t * 0.08 + 2.0), sin(t * 0.12)) * vec2(0.62, 0.24);
  float d1 = length((p - c1) * vec2(0.66, 1.0));
  float d2 = length((p - c2) * vec2(0.72, 1.0));
  return vec4(1.0-smoothstep(0.28, 1.18, d1), 1.0-smoothstep(0.24, 1.04, d2), band(d1-q.x*0.32, 0.08), band(d2-q.z*0.28, 0.09));
}

vec4 glowField(vec2 p, float t, vec4 q){
  float curtain = sin(p.x * (1.2 + q.x) - t * 0.13) * 0.18;
  float haze = fbm(p * vec2(0.78, 2.6) + vec2(t * 0.05, 4.0));
  float core = band(p.y - curtain - (haze - 0.5) * 0.34, 0.18);
  float halo = band(p.y + curtain * 0.7 + (haze - 0.5) * 0.22, 0.42);
  return vec4(core, halo, core * (0.5 + 0.5 * sin(p.x * 2.2 + t)), haze * halo);
}

vec4 waveField(vec2 p, float t, vec4 q){
  float w1 = sin(p.x * (1.8 + q.x) - t * 0.16) + sin(p.y * (4.0 + q.y) + t * 0.11);
  float w2 = sin(p.x * (2.4 + q.z) + t * 0.10) - sin(p.y * 3.2 - t * 0.14);
  return vec4(0.5+0.5*sin(w1), 0.5+0.5*sin(w2), 1.0-smoothstep(0.10,0.72,abs(w1-w2)), 0.5+0.5*sin(w1+w2));
}

vec4 gelField(vec2 p, float t, vec4 q){
  vec2 c1 = vec2(-0.34 + sin(t*0.10)*0.28, sin(t*0.08)*0.16);
  vec2 c2 = vec2(0.42 + cos(t*0.09)*0.24, cos(t*0.07)*0.18);
  float g1 = 1.0-smoothstep(0.34,0.92,length((p-c1)*vec2(0.72,1.0)));
  float g2 = 1.0-smoothstep(0.30,0.86,length((p-c2)*vec2(0.72,1.0)));
  return vec4(g1,g2,min(g1,g2),smoothstep(0.16,0.72,g1+g2));
}

vec4 magnetField(vec2 p, float t, vec4 q){
  vec2 c = vec2(sin(t*0.12)*0.42, cos(t*0.09)*0.16);
  vec2 d = p-c;
  float r = length(d*vec2(0.62,1.0));
  float ridges = 0.5+0.5*sin(r*(9.0+q.x*3.0)-t*0.38+atan(d.y,d.x)*2.0);
  float mass = 1.0-smoothstep(0.42,1.48,r);
  return vec4(mass,ridges*mass,(1.0-ridges)*mass,band(r-q.z*0.42,0.08));
}

vec4 ringField(vec2 p, float t, vec4 q){
  vec2 left = p-vec2(-0.34+sin(t*0.10)*0.22,0.08);
  vec2 right = p-vec2(0.40-cos(t*0.09)*0.24,-0.10);
  float r1 = length(left*vec2(0.66,1.0));
  float r2 = length(right*vec2(0.66,1.0));
  return vec4(band(r1-q.x*0.34,0.09),band(r2-q.y*0.32,0.09),1.0-smoothstep(0.08,0.54,abs(r1-r2)),fbm(p*2.2+vec2(t*0.08)));
}

vec4 tensionField(vec2 p, float t, vec4 q){
  float seam = p.y-sin(p.x*(1.2+q.x)+t*0.12)*0.22-(fbm(p*1.6+vec2(t*0.04))-0.5)*0.26;
  float gap = smoothstep(0.04,0.20,abs(seam));
  float skin = 1.0-smoothstep(0.18,0.58,abs(seam));
  return vec4(skin*(seam>0.0?1.0:0.0),skin*(seam<0.0?1.0:0.0),1.0-gap,band(seam,0.08));
}

vec4 interferenceField(vec2 p, float t, vec4 q){
  float a = length((p-vec2(-0.46,0.0))*vec2(0.68,1.0));
  float b = length((p-vec2(0.52,0.04))*vec2(0.68,1.0));
  float phase = sin((a-b)*(8.0+q.x*3.0)-t*0.24);
  float tide = sin((a+b)*(3.0+q.z)-t*0.10);
  return vec4(0.5+0.5*phase,0.5-0.5*phase,0.5+0.5*tide,1.0-smoothstep(0.12,0.78,abs(phase-tide)));
}

vec4 forceField(vec2 p, float t, vec4 q){
  float left = 1.0-smoothstep(0.24,1.18,length((p-vec2(-0.42+sin(t*0.08)*0.20,0.0))*vec2(0.62,1.0)));
  float right = 1.0-smoothstep(0.24,1.18,length((p-vec2(0.46-cos(t*0.07)*0.18,0.0))*vec2(0.62,1.0)));
  float flow = fbm(p*vec2(1.0+q.x*0.3,2.8)+vec2(t*0.06,-t*0.04));
  return vec4(left,right,min(left,right)*(0.5+flow),max(left,right)*(1.0-flow*0.34));
}

vec4 filamentField(vec2 p, float t, vec4 q){
  float n = fbm(p*vec2(0.84,3.8)+vec2(t*0.16,-t*0.08));
  float f1 = 0.5+0.5*sin((p.y+(n-0.5)*0.54)*(8.0+q.x*4.0)+p.x*1.6-t*0.42);
  float f2 = 0.5+0.5*sin((p.y-(n-0.5)*0.46)*(10.0+q.y*3.0)-p.x*1.2+t*0.34);
  return vec4(f1,f2,smoothstep(0.56,0.94,f1),smoothstep(0.60,0.96,f2));
}
```

Select exactly one helper for kernels `1–12` and retain the existing shader path for `kernel == 0`:

```glsl
vec4 materialFields = vec4(0.0);
if(kernel==1) materialFields=veilField(p,flowTime,studyParams);
if(kernel==2) materialFields=filmField(p,flowTime,studyParams);
if(kernel==3) materialFields=lensField(p,flowTime,studyParams);
if(kernel==4) materialFields=glowField(p,flowTime,studyParams);
if(kernel==5) materialFields=waveField(p,flowTime,studyParams);
if(kernel==6) materialFields=gelField(p,flowTime,studyParams);
if(kernel==7) materialFields=magnetField(p,flowTime,studyParams);
if(kernel==8) materialFields=ringField(p,flowTime,studyParams);
if(kernel==9) materialFields=tensionField(p,flowTime,studyParams);
if(kernel==10) materialFields=interferenceField(p,flowTime,studyParams);
if(kernel==11) materialFields=forceField(p,flowTime,studyParams);
if(kernel==12) materialFields=filamentField(p,flowTime,studyParams);
```

Update the atlas renderer with:

```ts
kernel: gl.getUniformLocation(program, "kernel"),
studyParams: gl.getUniformLocation(program, "studyParams"),
```

```ts
gl.uniform1i(uniforms.kernel, config.kernel);
gl.uniform4fv(uniforms.studyParams, config.params);
```

Update `buildEmbed` to emit the same uniforms with finite parameters clamped to `-2..2`. Do not add a texture, framebuffer, or second WebGL context.

- [ ] **Step 4: Build and run core tests**

Run: `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build; node --test tests/card-core.test.mjs`

Expected: build exits 0 and all core tests PASS.

- [ ] **Step 5: Commit the kernels**

```bash
git add app/card-core.ts app/page.tsx tests/card-core.test.mjs
git commit -m "feat: add shared optical and force kernels"
```

### Task 3: Three-page twelve-card gallery

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `MOTION_STUDIES`, `MOTION_PAGE_SIZE`, and all thirty-six configs.
- Produces: three page buttons, active-page slicing, external labels, and exactly twelve mounted canvases.

- [ ] **Step 1: Write failing rendered-page tests**

Add these assertions to the server-rendered and source tests:

```js
assert.equal((html.match(/class="card-study"/g) || []).length, 12);
assert.equal((html.match(/<canvas/g) || []).length, 12);
["01–12", "13–24", "25–36"].forEach((label) => assert.match(html, new RegExp(label)));
["01 · 柔雾扩散", "02 · 薄纱碰撞", "03 · 横向薄纱", "11 · 急速奔流", "12 · 慢纱呼吸"]
  .forEach((label) => assert.match(html, new RegExp(label)));
assert.doesNotMatch(html, /13 · 油膜涌色/);
assert.match(source, /cards\.slice\(pageStart, pageStart \+ MOTION_PAGE_SIZE\)/);
assert.match(source, /aria-current=\{pageIndex === index \? "page" : undefined\}/);
assert.match(source, /setPageIndex\(0\)/);
```

- [ ] **Step 2: Run rendered tests and verify red**

Run: `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build; node --test tests/rendered-html.test.mjs`

Expected: FAIL because page controls and slicing are absent.

- [ ] **Step 3: Implement page state, labels, and controls**

Import `MOTION_PAGE_SIZE` and `MOTION_STUDIES`. Replace the local name array with `MOTION_STUDIES[config.variant].name`. Add:

```ts
const pages = [
  { range: "01–12", title: "雾与薄纱" },
  { range: "13–24", title: "光学材质" },
  { range: "25–36", title: "流体力场" },
] as const;

const [pageIndex, setPageIndex] = useState(0);
const pageStart = pageIndex * MOTION_PAGE_SIZE;
const visibleCards = cards.slice(pageStart, pageStart + MOTION_PAGE_SIZE);
```

Render before `AtlasGallery`:

```tsx
<nav className="page-tabs" aria-label="效果分页">
  {pages.map((page, index) => (
    <button
      key={page.range}
      className="page-tab"
      aria-current={pageIndex === index ? "page" : undefined}
      onClick={() => setPageIndex(index)}
    >
      <span>{page.range}</span>
      <small>{page.title}</small>
    </button>
  ))}
</nav>
<AtlasGallery configs={visibleCards} playing={playing} />
```

Reset must call both `setCards(makeCards(20260807))` and `setPageIndex(0)`. Randomization maps every stored card. Set `ATLAS_ROWS = Math.ceil(MOTION_PAGE_SIZE / ATLAS_COLUMNS)`. Add compact `.page-tabs` and `.page-tab` CSS; `[aria-current="page"]` is dark, tabs wrap on narrow screens, and existing card/two-column rules remain unchanged.

Update the visible collection copy to `三十六张卡片，三十六种动态。`, the initial/random/reset notices to `三十六款…`, the intro to explain three pages of twelve, and the footer to `ONE WEBGL CONTEXT · THIRTY-SIX MOTION STUDIES`.

- [ ] **Step 4: Build and run all automated tests**

Run: `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build; node --test tests/card-core.test.mjs tests/rendered-html.test.mjs; git diff --check`

Expected: build exits 0, every test PASSes, and the diff check is empty.

- [ ] **Step 5: Commit pagination**

```bash
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: paginate thirty-six motion studies"
```

### Task 4: Browser visual QA and refinement

**Files:**
- Modify only after a reproduced issue: `app/card-core.ts`, `app/page.tsx`, `app/globals.css`, and matching tests.

**Interfaces:**
- Consumes: the complete three-page gallery.
- Produces: a browser-verified local demo without shader warnings, blank studies, or broken controls.

- [ ] **Step 1: Inspect all three pages**

At `http://localhost:3000/`, verify each page has twelve labels and canvases, exact ranges/chapter names, and only the active tab has `aria-current="page"`.

- [ ] **Step 2: Verify motion and visual identity**

Capture a full-page screenshot of each page. Compare every canvas at two time points; observe slow studies 12 and 36 for 2.5 seconds. Page 1 must read as layered veil derivatives, page 2 as optical/translucent material, and page 3 as force-driven motion. For any flat or duplicate replacement, add a source-level regression assertion, adjust its catalog parameters or kernel math, and rerun the affected test.

- [ ] **Step 3: Verify controls and responsive layout**

Confirm all-36 randomization changes configs while names/order remain stable, pause freezes a visible canvas, play resumes it, reset returns to page 1, hover applies the card transform, desktop uses two `400px` columns, and a `760px` viewport uses one column.

- [ ] **Step 4: Verify browser health and rendering limits**

Confirm console warning/error logs are empty, only twelve visible canvases and one WebGL2 context are mounted, and the hidden atlas remains `2 × 6` tiles at no more than DPR `1.5`.

- [ ] **Step 5: Run final verification and commit refinements**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git diff --check
git status --short
```

Expected: build exits 0, every test passes, no whitespace errors appear, and only intentional QA refinements are pending.

If refinements exist:

```bash
git add app/card-core.ts app/page.tsx app/globals.css tests/card-core.test.mjs tests/rendered-html.test.mjs
git commit -m "fix: refine thirty-six motion studies"
```
