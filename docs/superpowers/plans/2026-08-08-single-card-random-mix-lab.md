# Single-card Random Mix Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/lab` page where the user chooses only 2–6 effects and generates one `400 × 100` SPECTRA card whose studies, interaction modes, irregular bounded speeds, and coordinated colors are randomized.

**Architecture:** Keep the existing 72-study gallery unchanged. Add a pure deterministic recipe/clock module, build a dedicated lab shader by reusing the validated study-rendering body from `card-core.ts`, and drive one WebGL2 canvas from a focused React preview component. The lab uses one context, one canvas, one draw per frame, no framebuffer feedback, and no new dependency.

**Tech Stack:** TypeScript, React 19, WebGL2/GLSL ES 3.00, Node test runner, ESLint, Vinext/Vite, Cloudflare Workers.

## Global Constraints

- The only generative input is effect count: exactly `2`, `3`, `4`, `5`, or `6`.
- The preview is `400 × 100px`, 4:1, with a 25% copy / 75% animated-color split.
- Keep copy exactly `SPECTRA` and `COLOR AS A LIVING SYSTEM.`
- Effects interact simultaneously; do not animate a transition from the previous recipe.
- Each layer has positive, continuously integrated speed that wanders within randomized minimum and maximum bounds.
- Use 3–6 coordinated colors and prevent muddy gray or clipped output.
- Use one WebGL2 context, one canvas, one draw call per frame, and at most six active layers.
- Preserve the current `/` gallery, all 72 motion-study identities, the existing Cloudflare Worker route, and the `workers.dev` fallback.
- Add no runtime dependency, texture asset, CPU particle system, second canvas, framebuffer, persistence, export, history, or manual layer editor.
- Respect `prefers-reduced-motion`, keyboard focus, 44px touch targets, hidden-tab pausing, and static-gradient fallback.
- Do not use Sites hosting; the user previously chose the existing Cloudflare Worker deployment.

---

### Task 1: Deterministic recipe generator and irregular phase clocks

**Files:**
- Create: `app/lab/lab-core.ts`
- Create: `tests/lab-core.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `MOTION_STUDIES`, `MotionStudy`, `hexToRgb`, and `SMOKE_TIME_SCALE`.
- Produces: `LabRecipe`, `LabLayer`, `SpeedProfile`, `createLabRecipe(effectCount, seed)`, `velocityAt(profile, elapsedSeconds)`, `advancePhaseTimes(recipe, phaseTimes, elapsedSeconds, deltaSeconds)`, `formatLabRecipe(recipe)`, and `packLabRecipe(recipe)`.

- [ ] **Step 1: Write the failing recipe tests**

Create `tests/lab-core.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERACTION_LABELS,
  LAB_MAX_LAYERS,
  advancePhaseTimes,
  createLabRecipe,
  formatLabRecipe,
  packLabRecipe,
  velocityAt,
} from "../app/lab/lab-core.ts";

test("recipes are deterministic and contain the requested unique studies", () => {
  for (let count = 2; count <= LAB_MAX_LAYERS; count += 1) {
    const recipe = createLabRecipe(count, 20260808 + count);
    assert.deepEqual(recipe, createLabRecipe(count, 20260808 + count));
    assert.equal(recipe.effectCount, count);
    assert.equal(recipe.layers.length, count);
    assert.equal(new Set(recipe.layers.map(({ studyId }) => studyId)).size, count);
    assert.equal(recipe.interactions.length, count - 1);
    assert.ok(recipe.palette.length >= 3 && recipe.palette.length <= 6);
    assert.ok(Math.abs(recipe.layers.reduce((sum, layer) => sum + layer.weight, 0) - 1) < 1e-6);
  }
});

test("counts and randomized fields stay bounded", () => {
  assert.equal(createLabRecipe(1, 1).effectCount, 2);
  assert.equal(createLabRecipe(9, 1).effectCount, 6);
  const recipe = createLabRecipe(6, 88);
  recipe.layers.forEach((layer) => {
    assert.ok(layer.speed.min >= 0.12);
    assert.ok(layer.speed.max <= 2.6);
    assert.ok(layer.speed.max - layer.speed.min >= 0.28);
    assert.ok(layer.intensity >= 0.45 && layer.intensity <= 0.95);
    assert.match(layer.colorA, /^#[0-9a-f]{6}$/i);
    assert.match(layer.colorB, /^#[0-9a-f]{6}$/i);
  });
  recipe.interactions.forEach((mode) => assert.ok(mode in INTERACTION_LABELS));
});

test("speed is bounded and accumulated phase never reverses", () => {
  const recipe = createLabRecipe(6, 2026);
  const phases = new Float32Array(LAB_MAX_LAYERS);
  let elapsed = 0;
  for (let frame = 0; frame < 1200; frame += 1) {
    const before = phases.slice();
    elapsed += 1 / 60;
    advancePhaseTimes(recipe, phases, elapsed, 1 / 60);
    recipe.layers.forEach((layer, index) => {
      const velocity = velocityAt(layer.speed, elapsed);
      assert.ok(velocity >= layer.speed.min && velocity <= layer.speed.max);
      assert.ok(phases[index] >= before[index]);
    });
  }
});

test("packing creates six fixed slots and readable copy", () => {
  const recipe = createLabRecipe(3, 33);
  const packed = packLabRecipe(recipe);
  assert.equal(packed.variants.length, 6);
  assert.equal(packed.params.length, 24);
  assert.equal(packed.colorsA.length, 18);
  assert.equal(packed.transforms.length, 24);
  assert.match(formatLabRecipe(recipe), / × /);
  assert.match(formatLabRecipe(recipe), / \/ /);
});
```

- [ ] **Step 2: Verify RED**

Temporarily add `tests/lab-core.test.mjs` to the explicit `npm test` list and run:

```powershell
node --test tests/lab-core.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `app/lab/lab-core.ts`.

- [ ] **Step 3: Implement the pure core**

Create these exact public definitions in `app/lab/lab-core.ts`:

```ts
export const LAB_MAX_LAYERS = 6;
export const INTERACTION_LABELS = {
  0: "融合", 1: "碰撞", 2: "交缠",
  3: "吞噬", 4: "光叠", 5: "差异切割",
} as const;

export type InteractionMode = keyof typeof INTERACTION_LABELS;
export type SpeedProfile = {
  min: number;
  max: number;
  wanderRate: number;
  surgeRate: number;
  seed: number;
};
export type LabLayer = {
  studyId: number;
  name: string;
  chapter: number;
  variant: number;
  kernel: number;
  params: readonly [number, number, number, number];
  seed: number;
  intensity: number;
  scale: number;
  angle: number;
  warp: number;
  weight: number;
  colorA: string;
  colorB: string;
  speed: SpeedProfile;
};
export type LabRecipe = {
  seed: number;
  effectCount: number;
  paletteName: string;
  palette: string[];
  layers: LabLayer[];
  interactions: InteractionMode[];
};
```

Use the existing Mulberry32 sequence from `createPreset` locally. Select without replacement, weighting unused chapters at `4`, used chapters at `1`, and candidates sharing a selected kernel at `0.45`. Generate 3–6 HSL colors from one of five named strategies: 邻近雾化、冷暖对撞、三角色交缠、主色高光、低饱和墨流. Normalize randomized layer weights to sum to `1`.

Implement bounded value-noise speed and integration exactly as follows:

```ts
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);

const hashUnit = (seed: number, index: number) => {
  let value = Math.imul((seed ^ index) >>> 0, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};

const valueNoise = (seed: number, value: number) => {
  const index = Math.floor(value);
  const fraction = smoothstep(value - index);
  const a = hashUnit(seed, index);
  return a + (hashUnit(seed, index + 1) - a) * fraction;
};

export function velocityAt(profile: SpeedProfile, elapsedSeconds: number) {
  const wander = valueNoise(profile.seed, elapsedSeconds * profile.wanderRate);
  const surgeNoise = valueNoise(profile.seed ^ 0x9e3779b9, elapsedSeconds * profile.surgeRate);
  const surge = smoothstep(clamp((surgeNoise - 0.76) / 0.24, 0, 1));
  return profile.min + (profile.max - profile.min) *
    clamp(wander * 0.82 + surge * 0.18, 0, 1);
}

export function advancePhaseTimes(
  recipe: LabRecipe,
  phaseTimes: Float32Array,
  elapsedSeconds: number,
  deltaSeconds: number,
) {
  const delta = clamp(deltaSeconds, 0, 0.05);
  recipe.layers.forEach((layer, index) => {
    phaseTimes[index] += velocityAt(layer.speed, elapsedSeconds) *
      delta * SMOKE_TIME_SCALE;
  });
  return phaseTimes;
}
```

`packLabRecipe` returns fixed six-slot `Int32Array`/`Float32Array` buffers for variants, kernels, modes, seeds, intensities, params, two RGB colors, and `[scale, angle, weight, warp]` transforms. Inactive slots remain zero.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
node --test tests/lab-core.test.mjs
git add package.json app/lab/lab-core.ts tests/lab-core.test.mjs
git commit -m "feat: add deterministic random mix recipes"
```

Expected: 4 tests pass and the commit contains only the pure generator, clocks, and tests.

---

### Task 2: One-draw multi-study shader

**Files:**
- Create: `app/lab/lab-shader.ts`
- Create: `tests/lab-shader.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `FRAGMENT_SHADER` and `VERTEX_SHADER` from `app/card-core.ts`.
- Produces: `LAB_VERTEX_SHADER` and `LAB_FRAGMENT_SHADER`.

- [ ] **Step 1: Write the failing shader tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { LAB_FRAGMENT_SHADER, LAB_VERTEX_SHADER } from "../app/lab/lab-shader.ts";

test("shader has six slots and one active-layer loop", () => {
  assert.match(LAB_VERTEX_SHADER, /gl_Position/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform int layerCount;/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform float layerTimes\[6\];/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform int layerKernels\[6\];/);
  assert.match(LAB_FRAGMENT_SHADER, /for\(int i = 0; i < 6; i\+\+\)/);
  assert.match(LAB_FRAGMENT_SHADER, /if\(i >= layerCount\) break;/);
});

test("shader reuses study rendering and has six interactions", () => {
  assert.match(LAB_FRAGMENT_SHADER, /vec3 renderStudy\(vec2 uv\)/);
  assert.match(LAB_FRAGMENT_SHADER, /vec3 interactLayers\(/);
  [0, 1, 2, 3, 4, 5].forEach((mode) =>
    assert.match(LAB_FRAGMENT_SHADER, new RegExp("mode == " + mode)));
  assert.match(LAB_FRAGMENT_SHADER, /interactionWarp \+=/);
  assert.doesNotMatch(LAB_FRAGMENT_SHADER, /sampler2D|framebuffer|particles/i);
});

test("shader preserves white entry and compresses dense color", () => {
  assert.match(LAB_FRAGMENT_SHADER, /smoothstep\(0\.0, 0\.18, uv\.x\)/);
  assert.match(LAB_FRAGMENT_SHADER, /color = color \/ \(vec3\(0\.82\) \+ color \* 0\.28\)/);
});
```

- [ ] **Step 2: Register the test and verify RED**

Set `package.json` to run all four files:

```json
"test": "npm run build && node --test tests/card-core.test.mjs tests/lab-core.test.mjs tests/lab-shader.test.mjs tests/rendered-html.test.mjs"
```

Run `node --test tests/lab-shader.test.mjs`.

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Reuse the validated atlas study body**

Create `app/lab/lab-shader.ts`:

```ts
import { FRAGMENT_SHADER, VERTEX_SHADER } from "../card-core.ts";
export const LAB_VERTEX_SHADER = VERTEX_SHADER;

const functionsStart = FRAGMENT_SHADER.indexOf("float hash");
const mainStart = FRAGMENT_SHADER.indexOf("\nvoid main(){", functionsStart);
const bodyStart = FRAGMENT_SHADER.indexOf("  vec2 p =", mainStart);
const outputStart = FRAGMENT_SHADER.indexOf(
  "  outColor = vec4(color, 1.0);",
  bodyStart,
);
if ([functionsStart, mainStart, bodyStart, outputStart].some((index) => index < 0)) {
  throw new Error("The atlas shader no longer exposes the expected study body");
}
// ponytail: reuse the validated 72-study body; split shared GLSL only if a third renderer appears.
const studyFunctions = FRAGMENT_SHADER.slice(functionsStart, mainStart);
const studyBody = FRAGMENT_SHADER.slice(bodyStart, outputStart);
```

Build `LAB_FRAGMENT_SHADER` from:
1. GLSL 300 header and fixed arrays for six times, seeds, intensities, variants, kernels, params, color pairs, transforms, and modes.
2. Mutable globals matching the atlas study-body names.
3. `studyFunctions`.
4. `vec3 renderStudy(vec2 uv)` containing `studyBody` and `return color;`.
5. `vec3 interactLayers(...)` with explicit fusion, collision, interweave, engulf, screen, and difference branches.
6. One `for(int i = 0; i < 6; i++)` main loop assigning globals, transforming UV, calculating density, interacting, and adding `interactionWarp`.
7. Final color compression `color = color / (vec3(0.82) + color * 0.28);` and white gate `smoothstep(0.0, 0.18, uv.x)`.

- [ ] **Step 4: Verify and commit**

```powershell
node --test tests/card-core.test.mjs tests/lab-core.test.mjs tests/lab-shader.test.mjs
git add package.json app/lab/lab-shader.ts tests/lab-shader.test.mjs
git commit -m "feat: blend multiple motion studies in one shader"
```

Expected: all focused tests pass; existing shader tests remain unchanged.

---

### Task 3: Single-canvas preview component

**Files:**
- Create: `app/lab/lab-preview.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `LabRecipe`, `packLabRecipe`, `advancePhaseTimes`, and both lab shaders.
- Produces: `LabPreview({ recipe, playing, onFallbackChange })`, rendering exactly one canvas.

- [ ] **Step 1: Add a failing source-contract test**

```js
test("the lab preview uses one context, one canvas, and integrated clocks", async () => {
  const source = await readFile(new URL("../app/lab/lab-preview.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/getContext\("webgl2"/g) || []).length, 1);
  assert.equal((source.match(/<canvas/g) || []).length, 1);
  assert.match(source, /advancePhaseTimes\(/);
  assert.match(source, /uniform1fv\(uniforms\.layerTimes/);
  assert.match(source, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(source, /if \(document\.hidden\) return;/);
  assert.doesNotMatch(source, /createFramebuffer|drawImage|getContext\("2d"/);
});
```

Run `node --test tests/rendered-html.test.mjs`.

Expected: FAIL because the component file is absent.

- [ ] **Step 2: Implement the WebGL lifecycle**

Create a client component with refs for the canvas, current recipe, playing state, a reused six-float phase buffer, static-upload callback, and draw callback. Keep this exact public contract:

```tsx
export type LabPreviewProps = {
  recipe: LabRecipe;
  playing: boolean;
  onFallbackChange: (fallback: boolean) => void;
};

export function LabPreview(props: LabPreviewProps): React.JSX.Element;
```

The initialization effect must request one `webgl2` context with `alpha:false` and `antialias:false`, compile/link, allocate one fullscreen quad, cache array uniform locations using `[0]`, upload static packed buffers only after randomization, update only global time and six phase values per frame, and call one `gl.drawArrays`.

Use `ResizeObserver`, defer resize through `requestAnimationFrame`, cap DPR at `1.5`, skip hidden documents, clamp delta through `advancePhaseTimes`, delete all GL resources on cleanup, and call `onFallbackChange(true)` instead of throwing when WebGL fails. The playback effect owns one RAF loop only while `playing`; recipe changes reset phases and draw one static frame while paused.

- [ ] **Step 3: Verify and commit**

```powershell
npm run lint
node --test tests/rendered-html.test.mjs
git add app/lab/lab-preview.tsx tests/rendered-html.test.mjs
git commit -m "feat: render one random mix card"
```

Expected: lint and the source contract pass.

---

### Task 4: Lab page, read-only recipe, and navigation

**Files:**
- Create: `app/lab/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Task 1 core and Task 3 preview.
- Produces: `/lab`, count controls, randomize/pause actions, one card, read-only recipe, responsive layout, fallback status, and links between gallery and lab.

- [ ] **Step 1: Add failing SSR and CSS tests**

Generalize the existing `render()` helper to `render(pathname = "/")` and request `new URL(pathname, "http://localhost")`. Add:

```js
test("server-renders the single-card random mix lab", async () => {
  const response = await render("/lab");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /随机实验室/);
  assert.match(html, /选择效果数量/);
  assert.match(html, /一键随机创作/);
  assert.match(html, /COLOR AS A LIVING SYSTEM\./);
  [2, 3, 4, 5, 6].forEach((count) =>
    assert.match(html, new RegExp(">" + count + "<")));
  assert.equal((html.match(/<canvas/g) || []).length, 1);
  assert.equal((html.match(/class="preview-card lab-preview-card"/g) || []).length, 1);
  assert.match(html, /class="lab-recipe"/);
});

test("the gallery links to the random mix lab", async () => {
  const html = await (await render("/")).text();
  assert.match(html, /href="\/lab"[^>]*>随机实验室</);
});
```

Add source assertions for `.lab-shell`, `.effect-count`, `.lab-preview-card`, `.lab-recipe`, 44px count buttons, and the narrow-screen stack. Run build plus rendered tests and expect RED.

- [ ] **Step 2: Implement `app/lab/page.tsx`**

Use initial state `createLabRecipe(3, 20260808)`, effect count `3`, playing `true`, and fallback `false`. Randomization uses `crypto.getRandomValues(new Uint32Array(1))` and replaces the recipe immediately. Changing the count alone does not regenerate.

Render the existing two-column `.studio-shell`: left intro and controls; right one `.preview-card.lab-preview-card` containing the exact copy and `LabPreview`. Render a read-only recipe with `formatLabRecipe`, 3–6 palette swatches, study number/name, and each layer's min–max speed. Set playing false on mount when reduced motion is requested. Use `aria-pressed`, `aria-live`, a fieldset/legend, and native buttons.

- [ ] **Step 3: Add navigation and focused CSS**

Add `<a className="section-link" href="/lab">随机实验室</a>` to the gallery header and a “动态图谱” link back from the lab.

Add only these new style families to `app/globals.css`: `.section-link`, `.lab-shell`, `.lab-workspace`, `.lab-card-stage`, `.lab-preview-card`, `.effect-count`, `.lab-recipe`, and `.recipe-swatches`. Reuse existing card, hover, toolbar, rail, and reduced-motion rules. Fix the preview at 400px maximum, preserve 4:1 and 25/75, set count buttons to at least 44px, and stack through the existing 1100px/430px breakpoints.

- [ ] **Step 4: Verify and commit**

```powershell
npm run build
node --test tests/rendered-html.test.mjs
npm run lint
git add app/lab/page.tsx app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add single-card random mix lab"
```

Expected: both routes SSR successfully, the lab contains one canvas, and lint passes.

---

### Task 5: Full verification, GitHub publication, and Worker deployment

**Files:**
- Verify: `app/lab/**`, `app/page.tsx`, `app/globals.css`, `tests/**`, and `dist/server/wrangler.json`.
- Modify only when verification exposes a concrete defect.

**Interfaces:**
- Consumes: completed feature and existing GitHub/Cloudflare sessions.
- Produces: clean synchronized `master` and live `https://spectra.8538690.xyz/lab`.

- [ ] **Step 1: Run all verification**

```powershell
npm run lint
npm test
git diff --check
git status -sb
```

Expected: lint exits 0, build completes, all Node tests pass, diff check is empty, and only expected commits are ahead of `origin/master`.

- [ ] **Step 2: Confirm deployment configuration**

```powershell
$config = Get-Content -Raw -Encoding utf8 'dist/server/wrangler.json' | ConvertFrom-Json
$config.name
$config.workers_dev
$config.routes | ConvertTo-Json -Compress
```

Expected: `spectra-flux`, `True`, and the existing custom-domain route for `spectra.8538690.xyz`.

- [ ] **Step 3: Push and deploy without force**

```powershell
git push origin master
npx wrangler deploy --config dist/server/wrangler.json --message "Add SPECTRA random mix lab"
```

Expected: `origin/master` advances and Worker `spectra-flux` deploys while retaining custom and `workers.dev` routes.

- [ ] **Step 4: Verify live responses and repository alignment**

```powershell
$home = Invoke-WebRequest -Uri 'https://spectra.8538690.xyz/' -UseBasicParsing -TimeoutSec 30
$lab = Invoke-WebRequest -Uri 'https://spectra.8538690.xyz/lab' -UseBasicParsing -TimeoutSec 30
$home.StatusCode
$home.Content.Contains('SPECTRA FLUX')
$lab.StatusCode
$lab.Content.Contains('一键随机创作')
git status -sb
git rev-parse HEAD
git ls-remote origin refs/heads/master
```

Expected: `200`, `True`, `200`, `True`; worktree clean; local and remote `master` SHAs match.
