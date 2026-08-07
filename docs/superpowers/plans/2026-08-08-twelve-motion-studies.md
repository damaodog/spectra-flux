# Twelve Motion Studies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the gallery from six to twelve cards, move sequence/name labels outside each card, and add six visibly distinct motion identities for collision, diffusion, fusion, breathing, fast flow, and slow settling.

**Architecture:** Keep one detached WebGL2 atlas, one shader program, and one animation loop. Extend the current shader from variants `0–5` to `0–11`, render a two-column by six-row atlas, and cap twelve-card rendering at 1.5 DPR so total shaded pixels stay close to the current six-card version.

**Tech Stack:** React, TypeScript, WebGL2 GLSL ES 3.00, CSS, Node.js built-in test runner, vinext.

## Global Constraints

- Render exactly twelve 400 × 100 px cards with the existing 25% / 75% copy-to-visual split.
- Keep one `getContext("webgl2")`, one shader program, and one `requestAnimationFrame` loop.
- Keep desktop at two columns and switch to one column below 900 px.
- Put `01–12` and each study name outside the card; keep only `SPECTRA` and `COLOR AS A LIVING SYSTEM.` inside.
- Preserve existing variants `0–5`; add fixed identities for variants `6–11`.
- Randomize colors and seeds for all twelve cards without changing variant identity or semantic speed.
- Cap DPR at 1.5 when rendering more than six cards.
- Add no dependencies and no second rendering pipeline.

---

### Task 1: Expand gallery data and add six shader motion identities

**Files:**
- Modify: `tests/card-core.test.mjs`
- Modify: `app/card-core.ts`

**Interfaces:**
- Consumes: `createPreset(seed)`, the existing `CardConfig`, and the current shader uniforms.
- Produces: `SMOKE_VARIANT_COUNT === 12`, deterministic variants `0–11`, fixed new-variant speeds, and shader branches `variant == 6` through `variant == 11`.

- [ ] **Step 1: Update the gallery test and add semantic-speed coverage**

Replace the existing six-variant test and add the following speed test:

```js
test("createGallery returns twelve unique fixed variants", () => {
  const gallery = createGallery(2026);
  assert.equal(gallery.length, 12);
  assert.equal(gallery.length, SMOKE_VARIANT_COUNT);
  assert.deepEqual(
    gallery.map((card) => card.variant),
    Array.from({ length: 12 }, (_, index) => index),
  );
  assert.equal(new Set(gallery.map((card) => card.seed)).size, 12);
  assert.deepEqual(gallery, createGallery(2026));
  assert.notDeepEqual(gallery, createGallery(2027));
});

test("the six new motion studies keep semantic speed profiles", () => {
  const gallery = createGallery(2026);
  assert.deepEqual(
    gallery.slice(6).map((card) => card.speed),
    [1.05, 0.72, 0.82, 0.45, 1.6, 0.28],
  );
});
```

- [ ] **Step 2: Update shader-structure expectations and add identity coverage**

In `the shader keeps fast flow and limits the third field to weave variants`, replace the three family assertions and the `fogC` assertion with:

```js
assert.match(
  FRAGMENT_SHADER,
  /bool collisionFamily\s*=\s*variant < 2 \|\| variant == 6;/,
);
assert.match(FRAGMENT_SHADER, /bool weaveFamily\s*=\s*variant >= 2 && variant < 4;/);
assert.match(FRAGMENT_SHADER, /bool vortexFamily\s*=\s*variant >= 4 && variant < 6;/);
assert.match(
  FRAGMENT_SHADER,
  /if\(weaveFamily \|\| fusionVariant \|\| fastVariant\)\{\s*fogC = fbm\(/,
);
assert.equal((FRAGMENT_SHADER.match(/= fbm\(/g) || []).length, 3);
```

Add this new test:

```js
test("the shader exposes six new motion identities", () => {
  const identities = [
    [6, "impactCycle"],
    [7, "diffusionWave"],
    [8, "fusionShift"],
    [9, "breathPulse"],
    [10, "fastPhase"],
    [11, "slowLift"],
  ];

  identities.forEach(([variant, control]) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`if\\(variant == ${variant}\\)`));
    assert.match(FRAGMENT_SHADER, new RegExp(`float ${control}`));
  });
  assert.doesNotMatch(FRAGMENT_SHADER, /sampler2D|framebuffer/);
});
```

- [ ] **Step 3: Run the core tests and verify the expected failures**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: failures report a gallery length of 6 instead of 12, missing variants `6–11`, and missing new shader controls.

- [ ] **Step 4: Expand the variant count and define fixed semantic speeds**

In `app/card-core.ts`, change the count and add the speed table next to the existing constants:

```ts
export const SMOKE_VARIANT_COUNT = 12;
export const SMOKE_TIME_SCALE = 8;

const semanticSpeeds = [1.05, 0.72, 0.82, 0.45, 1.6, 0.28] as const;
```

Replace `createGallery` with:

```ts
export function createGallery(seed: number) {
  return Array.from({ length: SMOKE_VARIANT_COUNT }, (_, variant) => {
    const cardSeed = (seed + Math.imul(variant + 1, 0x9e3779b1)) >>> 0;
    const preset = createPreset(cardSeed);
    const semanticSpeed = semanticSpeeds[variant - 6];
    return {
      ...preset,
      speed: semanticSpeed ?? preset.speed,
      seed: cardSeed,
      variant,
    };
  });
}
```

- [ ] **Step 5: Extend shader family flags and the optional third field**

Replace the current family declarations with:

```glsl
  bool collisionFamily = variant < 2 || variant == 6;
  bool weaveFamily = variant >= 2 && variant < 4;
  bool vortexFamily = variant >= 4 && variant < 6;
  bool diffusionVariant = variant == 7;
  bool fusionVariant = variant == 8;
  bool breathVariant = variant == 9;
  bool fastVariant = variant == 10;
  bool slowVariant = variant == 11;
```

Replace the `fogC` condition with:

```glsl
  if(weaveFamily || fusionVariant || fastVariant){
    fogC = fbm(p * 4.1 + vec2(-flowDrift.x * 0.68, flowDrift.y * 0.92) + vec2(13.7, 4.9));
  }
```

Immediately after `vec4 outer = ...`, add:

```glsl
  float breathPulse = 1.0;
```

- [ ] **Step 6: Add the six exact spatial-motion branches**

Insert these branches after the existing `variant == 5` block and before family warps:

```glsl
  if(variant == 6){
    float impactCycle = 0.5 + 0.5 * sin(flowTime * 0.22 + phase);
    float approach = mix(0.62, 0.10, impactCycle);
    shape = warped;
    shape.x += (fogA - fogB) * 0.54;
    shape.y += sin(warped.x * 5.4 - flowTime * 0.34 + phase) * 0.11;
    centerA = vec2(-approach, 0.14);
    centerB = vec2(approach, -0.14);
    centerC = vec2(-approach * 0.72, -0.28);
    centerD = vec2(approach * 0.72, 0.28);
    scaleA = scaleB = scaleC = scaleD = vec2(0.46, 0.84);
    outer = vec4(0.74, 0.74, 0.66, 0.66);
  }
  if(variant == 7){
    float diffusionWave = 0.5 + 0.5 * sin(flowTime * 0.09 + phase);
    float diffusionScale = mix(1.16, 0.72, diffusionWave);
    shape = warped * diffusionScale;
    shape += normalize(warped + vec2(0.001)) * (fogA - 0.5) * 0.24;
    centerA = vec2(0.10, 0.04);
    centerB = vec2(0.30, -0.08);
    centerC = vec2(0.50, 0.16);
    centerD = vec2(0.66, -0.20);
    scaleA = vec2(0.58, 0.72);
    scaleB = vec2(0.64, 0.78);
    scaleC = vec2(0.72, 0.84);
    scaleD = vec2(0.80, 0.92);
    outer = mix(vec4(0.54, 0.50, 0.46, 0.42), vec4(0.92, 0.84, 0.76, 0.68), diffusionWave);
  }
  if(variant == 8){
    float fusionShift = sin(flowTime * 0.13 + phase) * 0.16;
    shape = warped + vec2(fogC - fogB, fogA - fogC) * 0.46;
    centerA = vec2(-0.04 + fusionShift, 0.12);
    centerB = vec2(0.20 - fusionShift, -0.10);
    centerC = vec2(0.42 + fusionShift * 0.60, 0.16);
    centerD = vec2(0.62 - fusionShift * 0.60, -0.14);
    scaleA = scaleB = scaleC = scaleD = vec2(0.58, 0.82);
    outer = vec4(0.84, 0.84, 0.78, 0.76);
  }
  if(variant == 9){
    breathPulse = 0.5 + 0.5 * sin(flowTime * 0.085 + phase);
    float breathScale = mix(0.82, 1.14, breathPulse);
    shape = warped * breathScale;
    centerA = vec2(-0.02, 0.12);
    centerB = vec2(0.26, -0.14);
    centerC = vec2(0.52, 0.18);
    centerD = vec2(0.78, -0.18);
    scaleA = scaleB = scaleC = scaleD = vec2(0.54, 0.82);
    outer = mix(vec4(0.86, 0.82, 0.78, 0.72), vec4(0.62, 0.60, 0.56, 0.52), breathPulse);
  }
  if(variant == 10){
    float fastPhase = flowTime * 0.72 + phase;
    shape = vec2(
      warped.x + sin(warped.y * 8.0 - fastPhase) * 0.22 + (fogC - 0.5) * 0.28,
      warped.y + sin(warped.x * 3.0 - fastPhase * 0.60) * 0.05
    );
    centerA = vec2(-0.12, 0.34);
    centerB = vec2(0.18, 0.10);
    centerC = vec2(0.50, -0.12);
    centerD = vec2(0.84, -0.34);
    scaleA = scaleB = scaleC = scaleD = vec2(0.34, 1.72);
    outer = vec4(0.62, 0.60, 0.58, 0.56);
  }
  if(variant == 11){
    float slowLift = sin(flowTime * 0.035 + phase) * 0.06;
    shape = warped + vec2((fogA - 0.5) * 0.18, (fogB - 0.5) * 0.12);
    centerA = vec2(-0.08, 0.18 + slowLift);
    centerB = vec2(0.28, -0.12 + slowLift * 0.50);
    centerC = vec2(0.58, 0.22 - slowLift * 0.40);
    centerD = vec2(0.86, -0.18 - slowLift * 0.60);
    scaleA = scaleB = scaleC = scaleD = vec2(0.36, 0.68);
    outer = vec4(0.94, 0.90, 0.86, 0.82);
  }
```

- [ ] **Step 7: Tune family warps, density, and color for the new variants**

Replace the collision warp body with:

```glsl
  if(collisionFamily){
    float impact = fogA - fogB;
    float collisionForce = variant == 6 ? 0.62 : (variant == 0 ? 0.42 : 0.30);
    shape += vec2(impact * collisionForce, (fogA + fogB - 1.0) * 0.18);
  }
```

Replace `detailC` with:

```glsl
  float detailC = (weaveFamily || fusionVariant || fastVariant) ? fogC : fogB;
```

After the four `layerAlpha` declarations, add:

```glsl
  float breathGain = breathVariant ? mix(0.70, 1.0, breathPulse) : 1.0;
  layerAlphaA *= breathGain;
  layerAlphaB *= breathGain;
  layerAlphaC *= breathGain;
  layerAlphaD *= breathGain;
```

After the existing collision/weave/vortex color blocks, add:

```glsl
  if(diffusionVariant){
    color = mix(color, mix(colorA, colorB, 0.34), smokeDensity * 0.08);
  }
  if(fusionVariant){
    color = mix(color, mixedInk, fusionMask * (0.38 + intensity * 0.22));
    color = mix(color, mix(colorA, colorB, fogC), pairwiseWeave * 0.16);
  }
  if(breathVariant){
    color = mix(color, mixedInk, fusionMask * 0.12 * breathGain);
  }
  if(fastVariant){
    float rushFilament = smoothstep(0.10, 0.58, abs(fogC - fogB)) * smokeDensity;
    color = mix(color, mix(colorA, colorB, fogC), rushFilament * 0.22);
  }
  if(slowVariant){
    color = mix(color, mixedInk, smokeDensity * 0.08);
  }
```

- [ ] **Step 8: Run core tests and verify all pass**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: 13 tests pass, 0 fail.

- [ ] **Step 9: Commit the data and shader work**

```powershell
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add six semantic smoke motions"
```

---

### Task 2: Render twelve studies with labels outside the cards

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `SMOKE_VARIANT_COUNT === 12` and the twelve configs returned by `createGallery()`.
- Produces: twelve `.card-study` wrappers, twelve external `.study-meta` labels, twelve cards/canvases, and a 2 × 6 shared atlas capped at 1.5 DPR.

- [ ] **Step 1: Change SSR expectations from six cards to twelve external studies**

Replace the card-count and metadata assertions in `server-renders the WebGL card generator` with:

```js
assert.equal((html.match(/class="card-study"/g) || []).length, 12);
assert.equal((html.match(/class="preview-card"/g) || []).length, 12);
assert.equal((html.match(/class="card-copy"/g) || []).length, 12);
assert.equal((html.match(/<canvas/g) || []).length, 12);
assert.equal((html.match(/class="study-meta"/g) || []).length, 12);
assert.equal((html.match(/class="card-meta"/g) || []).length, 0);
const studyMeta = [
  "01 · 柔雾扩散",
  "02 · 彩墨叠层",
  "03 · 横向薄纱",
  "04 · 墨滴晕染",
  "05 · 斜向漂移",
  "06 · 深景云雾",
  "07 · 双流撞击",
  "08 · 墨云扩散",
  "09 · 色域融合",
  "10 · 潮汐呼吸",
  "11 · 急速奔流",
  "12 · 慢雾沉降",
];
studyMeta.forEach((label) => assert.match(html, new RegExp(label)));
assert.equal((html.match(/--card-width:400px/g) || []).length, 12);
assert.equal((html.match(/--card-height:100px/g) || []).length, 12);
```

Add this structural assertion after the list:

```js
assert.match(
  html,
  /class="card-study"><span class="study-meta">01 · 柔雾扩散<\/span><article/,
);
```

- [ ] **Step 2: Update the shared-atlas source test**

Rename the test to `the gallery shares one WebGL atlas across twelve 2D canvases` and add:

```js
assert.match(
  source,
  /const ATLAS_ROWS = Math\.ceil\(SMOKE_VARIANT_COUNT \/ ATLAS_COLUMNS\);/,
);
assert.match(source, /configs\.length > 6 \? 1\.5 : 2/);
```

Keep the existing assertion that the source contains exactly one `getContext("webgl2")` call.

- [ ] **Step 3: Run the rendered-HTML tests and verify the expected failures**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
```

Expected: the SSR test reports 6 cards instead of 12 and the source test cannot find the dynamic atlas rows or 1.5 DPR cap.

- [ ] **Step 4: Expand names, derive atlas rows, and cap DPR**

Add `SMOKE_VARIANT_COUNT` to the import from `./card-core` and replace `variantNames` with:

```ts
const variantNames = [
  "柔雾扩散",
  "彩墨叠层",
  "横向薄纱",
  "墨滴晕染",
  "斜向漂移",
  "深景云雾",
  "双流撞击",
  "墨云扩散",
  "色域融合",
  "潮汐呼吸",
  "急速奔流",
  "慢雾沉降",
] as const;
```

Replace the atlas row constant with:

```ts
const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = Math.ceil(SMOKE_VARIANT_COUNT / ATLAS_COLUMNS);
```

Replace the resize ratio line with:

```ts
const ratio = Math.min(
  window.devicePixelRatio || 1,
  configs.length > 6 ? 1.5 : 2,
);
```

- [ ] **Step 5: Move metadata outside each card**

Replace the mapped `article` return block with:

```tsx
const studyNumber = String(index + 1).padStart(2, "0");

return (
  <div className="card-study" key={config.variant}>
    <span className="study-meta">
      {`${studyNumber} · ${variantNames[index]}`}
    </span>
    <article
      className="preview-card"
      style={cardStyle}
      aria-label={`SPECTRA ${studyNumber} ${variantNames[index]}`}
    >
      <div className="card-copy">
        <h2>{config.title}</h2>
        <p>{config.subtitle}</p>
      </div>
      <div className="card-visual">
        <canvas
          ref={(canvas) => {
            canvasRefs.current[index] = canvas;
          }}
          aria-hidden="true"
        />
      </div>
    </article>
  </div>
);
```

- [ ] **Step 6: Add wrapper/label CSS and remove the internal label rule**

Change the gallery gap and replace `.card-meta` with:

```css
.atlas-gallery {
  width: min(100%, 848px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 400px));
  justify-content: center;
  gap: 30px 48px;
}

.card-study {
  width: min(100%, 400px);
  display: grid;
  gap: 8px;
}

.study-meta {
  padding-left: 10px;
  color: #777982;
  font: 650 7px/1 ui-monospace, "SFMono-Regular", Consolas, monospace;
  letter-spacing: .08em;
  white-space: nowrap;
}
```

Keep `.preview-card`, `.card-copy`, and the existing responsive one-column rule unchanged.

- [ ] **Step 7: Update visible page copy from six to twelve**

Apply these exact replacements in `app/page.tsx`:

```text
六款墨流同时展示 -> 十二款墨流同时展示
六款已全部随机 -> 十二款已全部随机
已恢复六款默认墨流 -> 已恢复十二款默认墨流
SIX GENERATIVE SMOKE STUDIES / 2026 -> TWELVE GENERATIVE SMOKE STUDIES / 2026
六张卡片， -> 十二张卡片，
六种墨流。 -> 十二种墨流。
六张卡片由一个 WebGL 图集同步驱动。 -> 十二张卡片由一个 WebGL 图集同步驱动。
每次随机都会更新六套配色、种子与流动结构 -> 每次随机都会更新十二套配色、种子与流动结构
六张动态墨流卡片 -> 十二张动态墨流卡片
ONE WEBGL CONTEXT · SIX INK STUDIES -> ONE WEBGL CONTEXT · TWELVE INK STUDIES
```

- [ ] **Step 8: Run rendered and full tests**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git diff --check
```

Expected: the build exits 0, the four rendered tests pass, all 17 tests pass, and `git diff --check` reports no errors.

- [ ] **Step 9: Commit the twelve-card layout**

```powershell
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: render twelve labeled motion studies"
```

---

### Task 3: Browser performance and interaction verification

**Files:**
- Verify only: `app/page.tsx`, `app/globals.css`, `app/card-core.ts`

**Interfaces:**
- Consumes: the local dev server at `http://localhost:3000/`.
- Produces: evidence that twelve cards render distinctly and the UI remains responsive without WebGL warnings.

- [ ] **Step 1: Start or verify the worktree dev server**

Confirm the process listening on port 3000 points to `.worktrees/six-card-atlas-gallery`. If it is not running, start:

```powershell
Start-Process -FilePath 'npx.cmd' -ArgumentList @('vinext','dev') -WorkingDirectory 'C:\Users\狗大毛T2\Documents\Codex\2026-08-07\sites-plugin-sites-openai-bundled-2\.worktrees\six-card-atlas-gallery' -WindowStyle Hidden
```

- [ ] **Step 2: Verify desktop and responsive geometry**

At a 1280 px viewport, confirm:

- 12 `.card-study`, 12 `.preview-card`, and 12 canvas elements;
- `.atlas-gallery` computes to two 400 px columns;
- every card computes to 400 × 100 px;
- `.study-meta` bottom is above its card top and does not overlap the card;
- copy/visual widths remain approximately 99.5 px / 298.5 px after borders.

At a 760 px viewport, confirm the gallery computes to one 400 px column, then reset the viewport override.

- [ ] **Step 3: Verify visual motion identities and controls**

Confirm the six new cards visibly match their names:

- 07 converges toward a collision zone;
- 08 expands and softens;
- 09 produces a strong mixed-color overlap;
- 10 changes scale/density cyclically;
- 11 moves fastest with directional streaks;
- 12 moves slowest with broad fog.

Then verify:

- two screenshots 700 ms apart differ while playing;
- two screenshots 700 ms apart are identical while paused;
- random changes all twelve seeds/configs while leaving labels fixed;
- reset restores the initial twelve configs;
- hovering a card produces `matrix(1.015, 0, 0, 1.015, 0, -6)` without moving neighbors;
- browser warn/error logs are empty.

- [ ] **Step 4: Run final verification and inspect branch state**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git diff --check
git status --short
```

Expected: build exits 0, all 17 tests pass, `git diff --check` is clean, and the worktree has no uncommitted changes.
