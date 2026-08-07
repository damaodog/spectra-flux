# Six Smoke Card Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show six numbered smoke-card variants that randomize independently, use real translucent color-layer compositing, and default to 800 × 300 px with a 35:65 copy-to-color split.

**Architecture:** Keep one WebGL renderer and one fragment shader. Add a `variant` uniform for six fixed smoke structures, generate six deterministic presets from one master seed, and render them from one React gallery state. Shared copy and dimensions update all cards; each card exports its own HTML.

**Tech Stack:** React, TypeScript, WebGL2/GLSL ES 3.00, CSS Grid, Node test runner, Vinext.

## Global Constraints

- Default card size is exactly 800 × 300 px.
- Copy occupies 35% and colored smoke occupies 65% at every responsive size.
- All variants remain smoke/fog; no particles, ripples, rays, or fine texture.
- Randomization changes all six visual configurations independently without changing shared copy or dimensions.
- Use one shader, no new dependency, local-only at `http://localhost:3000/`, and no Sites deployment.

---

### Task 1: Six deterministic presets and default dimensions

**Files:**
- Modify: `app/card-core.ts`
- Test: `tests/card-core.test.mjs`

**Interfaces:**
- Produces: `CardConfig.variant: number`
- Produces: `DEFAULT_CARD_WIDTH`, `DEFAULT_CARD_HEIGHT`, `SMOKE_VARIANT_COUNT`
- Produces: `createGallery(seed: number)` returning six unique visual configs

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because the constants and `createGallery` are missing.

- [ ] **Step 3: Add the minimal implementation**

```ts
export const DEFAULT_CARD_WIDTH = 800;
export const DEFAULT_CARD_HEIGHT = 300;
export const SMOKE_VARIANT_COUNT = 6;

export function createGallery(seed: number) {
  return Array.from({ length: SMOKE_VARIANT_COUNT }, (_, variant) => {
    const cardSeed = (seed + Math.imul(variant + 1, 0x9e3779b1)) >>> 0;
    return { ...createPreset(cardSeed), seed: cardSeed, variant };
  });
}
```

- [ ] **Step 4: Run test and confirm GREEN**

Run: `node --test tests/card-core.test.mjs`

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add six deterministic smoke presets"
```

---

### Task 2: Independent translucent layers and six structures

**Files:**
- Modify: `app/card-core.ts`
- Test: `tests/card-core.test.mjs`

**Interfaces:**
- Consumes: `CardConfig.variant`
- Produces: fragment uniform `uniform int variant;`
- Updates: `buildEmbed(config)` to upload the integer variant uniform

- [ ] **Step 1: Write the failing shader and embed tests**

```js
test("the shader has six variants and independent alpha layers", () => {
  assert.match(FRAGMENT_SHADER, /uniform int variant;/);
  assert.match(FRAGMENT_SHADER, /float layerAlphaA\s*=/);
  assert.match(FRAGMENT_SHADER, /float layerAlphaB\s*=/);
  assert.match(FRAGMENT_SHADER, /float overlapInk\s*=/);
  assert.match(FRAGMENT_SHADER, /variant\s*==\s*5/);
  assert.doesNotMatch(FRAGMENT_SHADER, /cloudColor\s*=/);
});

assert.match(html, /uniform1i\(variant,1\)/);
```

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because the shader still averages cloud colors.

- [ ] **Step 3: Implement the six structures and Alpha compositing**

Add `uniform int variant;`, transform the warped coordinates by variant, and use fixed branches for ribbons, bloom, diagonal drift, and deep fog:

```glsl
vec2 shape = warped;
if(variant == 2) shape = vec2(warped.x * 0.72 + sin(warped.y * 3.2 + time * 0.22) * 0.18, warped.y * 1.34);
if(variant == 3) shape += normalize(shape + vec2(0.001)) * (fogB - 0.5) * 0.28;
if(variant == 4) shape = mat2(0.94, -0.34, 0.34, 0.94) * warped;
if(variant == 5) shape = warped + vec2((fogA - 0.5) * 0.42, (fogB - 0.5) * 0.18);
```

Replace the averaged smoke color with independent layers:

```glsl
float leftFade = smoothstep(0.02, 0.34, uv.x + fogA * 0.08);
float layerAlphaA = smoothstep(0.02, 0.82, cloudA) * leftFade;
float layerAlphaB = smoothstep(0.02, 0.82, cloudB) * leftFade;
float layerAlphaC = smoothstep(0.02, 0.82, cloudC) * leftFade;
float layerAlphaD = smoothstep(0.02, 0.82, cloudD) * leftFade;
float strength = 0.42 + intensity * 0.34;
vec3 color = vec3(0.985);
color = mix(color, colorA, layerAlphaA * strength);
color = mix(color, colorB, layerAlphaB * strength);
color = mix(color, mix(colorA, colorB, 0.32), layerAlphaC * strength * 0.82);
color = mix(color, mix(colorA, colorB, 0.72), layerAlphaD * strength * 0.76);
float overlapInk = min(layerAlphaA + layerAlphaC, layerAlphaB + layerAlphaD);
float inkBoost = variant == 1 ? 0.34 : 0.12;
color = mix(color, mix(colorA, colorB, 0.5), clamp(overlapInk * inkBoost, 0.0, 0.36));
```

At least one center remains beyond the right edge for each structure. Get `variant` with `gl.getUniformLocation` and upload it through `gl.uniform1i` in both preview and exported HTML.

- [ ] **Step 4: Run test and confirm GREEN**

Run: `node --test tests/card-core.test.mjs`

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: composite six translucent smoke styles"
```

---

### Task 3: Render and control the 2 × 3 gallery

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/card-core.ts`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `createGallery(masterSeed)` and default size constants
- Produces: six `CardConfig` values with labels `STYLE 01` through `STYLE 06`
- Produces: global random/play/reset and per-card HTML copy

- [ ] **Step 1: Write the failing render test**

```js
assert.match(html, /一键全部随机/);
assert.match(html, /STYLE 01/);
assert.match(html, /STYLE 06/);
assert.equal((html.match(/class="preview-card"/g) || []).length, 6);
assert.match(html, /--card-width:800px/);
assert.match(html, /--card-height:300px/);
```

- [ ] **Step 2: Build and confirm RED**

Run: `$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'; npm run build; node --test tests/rendered-html.test.mjs`

Expected: FAIL because one 1200 × 420 card is rendered.

- [ ] **Step 3: Replace the single config with six cards**

```ts
const sharedInitial = {
  title: "SPECTRA",
  subtitle: "COLOR AS A LIVING SYSTEM.",
  radius: 64,
  width: DEFAULT_CARD_WIDTH,
  height: DEFAULT_CARD_HEIGHT,
};

const makeCards = (seed: number): CardConfig[] =>
  createGallery(seed).map((visual, variant) => ({
    ...sharedInitial,
    ...visual,
    label: `STYLE ${String(variant + 1).padStart(2, "0")}`,
  }));
```

Use `useState(() => makeCards(20260807))`, map the cards into `.card-gallery`, and pass each variant to `WebGLPreview`. Random replaces all six visual configs. Shared copy, radius, width, and height controls map updates across all six cards. Each gallery item gets a `复制此样式` button calling `buildEmbed(card)`.

- [ ] **Step 4: Add responsive gallery CSS**

```css
.card-gallery { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:28px; }
.gallery-item { min-width:0; }
.preview-card { width:100%; min-height:0; aspect-ratio:8/3; grid-template-columns:35% 65%; }
@media (max-width:900px) { .card-gallery { grid-template-columns:1fr; } }
```

Remove the mobile rule that stacks the copy and visual sections. Reduce preview typography and padding so the 35% copy column remains readable.

- [ ] **Step 5: Preserve the ratio in exported HTML**

Use `aspect-ratio:${width}/${height}` with `grid-template-columns:35% 65%` on `[data-luma-card]`, and remove the export media rule that stacks the card.

- [ ] **Step 6: Run the full suite and confirm GREEN**

Run: `$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'; npm test`

Expected: production build succeeds and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/globals.css app/card-core.ts tests/rendered-html.test.mjs
git commit -m "feat: show six random smoke card variants"
```

---

### Task 4: Local browser verification

**Files:**
- Modify only for verified defects: `app/card-core.ts`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Inspect the local page**

At `http://localhost:3000/`, confirm six cards, six canvases, labels `STYLE 01` through `STYLE 06`, no `.webgl-error`, and no browser warnings/errors.

- [ ] **Step 2: Verify geometry**

Evaluate each card box and computed grid columns. Width/height must be within `0.03` of `8 / 3`; copy and visual columns must be within two pixels of 35% and 65%.

- [ ] **Step 3: Verify controls**

Capture frames 800 ms apart and confirm animation changes. Pause and resume all six. Randomize and confirm all six seed labels change and remain unique.

- [ ] **Step 4: Inspect the six visuals**

Confirm the structures are visibly different, style 02 has the strongest colored overlap, all right edges remain colored, and no style contains particles, ripples, or hard fine texture.

- [ ] **Step 5: Run final verification**

Run: `$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'; npm test`

Run: `git diff --check`

Run: `git status --short`

Expected: tests pass, no whitespace errors, and only intentional changes remain.
