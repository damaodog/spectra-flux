# Three Ink-Flow Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing six smoke variants into two collision, two interweaving, and two vortex-flow ink looks, and add whole-card lift/shadow feedback without increasing the page beyond one WebGL canvas.

**Architecture:** Keep the existing `CardConfig`, gallery generation, React component, uniforms, and single fragment-shader draw path. Select one of three shader families from the existing integer `variant`; evaluate the third FBM field only for variants 2–3, and use analytic vortex warps rather than feedback-framebuffer fluid simulation for variants 4–5. Add hover feedback with CSS only.

**Tech Stack:** React 19, TypeScript, WebGL2/GLSL ES 3.00, CSS, Node test runner, vinext/Vite

## Global Constraints

- Keep the card at exactly 400×100 and retain the 35% copy / 65% visual split.
- Keep one WebGL context, one canvas, one draw call per frame, and no new runtime dependencies or texture assets.
- Preserve `SMOKE_TIME_SCALE = 8`, the `travelTime = time * 0.025` macro clock, continuously advancing local drift, randomize/reset, pause/play, and static WebGL fallback.
- Variants 0–1 are dual-noise collision, 2–3 are triple-noise interweaving, and 4–5 are fluid-like vortex flow.
- Do not add framebuffer ping-pong, multiple canvases, CPU particles, pointer-driven ink disturbance, export, or deployment.
- Whole-card hover is approximately `translateY(-6px) scale(1.015)` with a 220–280ms transition; reduced motion removes translation and scale.

---

## File structure

- Modify `app/card-core.ts`: retain the public card API and replace only the fragment-shader field deformation and color-compositing logic.
- Modify `app/globals.css`: add whole-card hover and reduced-motion overrides using native CSS.
- Modify `tests/card-core.test.mjs`: lock the shader-family boundaries, conditional third FBM, vortex warp, collision/fusion masks, and existing motion/performance invariants.
- Modify `tests/rendered-html.test.mjs`: read the source stylesheet and lock the pointer-hover and reduced-motion behavior while retaining the one-card/one-canvas server-render checks.
- No application files or dependencies are added.

### Task 1: Implement the three fragment-shader families

**Files:**
- Modify: `tests/card-core.test.mjs:94-123`
- Modify: `app/card-core.ts:25-180`

**Interfaces:**
- Consumes: existing `uniform int variant`, `uniform float time`, `uniform float seed`, `uniform float intensity`, `uniform vec3 colorA`, and `uniform vec3 colorB`.
- Produces: the unchanged exported `FRAGMENT_SHADER: string`; family selection remains `0–1`, `2–3`, `4–5`, so no React or embed API changes are required.

- [ ] **Step 1: Write failing shader-family tests**

Replace the existing `"the shader separates fast flow from long travel without extra FBM work"` and `"the shader has six variants and independent alpha layers"` tests with the following tests. Leave the other tests unchanged.

```js
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
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: FAIL in the new family tests because `collisionFamily`, `weaveFamily`, `vortexFamily`, `fogC`, `vortexWarp`, `collisionMask`, and weave masks do not exist; the current shader also has two rather than three textual FBM evaluations.

- [ ] **Step 3: Add the analytic vortex helper**

In `FRAGMENT_SHADER`, insert this function immediately after `fbm` and before `main`:

```glsl
vec2 vortexWarp(vec2 point, vec2 center, float spin, float falloff){
  vec2 delta = point - center;
  float influence = exp(-dot(delta, delta) * falloff);
  return vec2(-delta.y, delta.x) * spin * influence;
}
```

This produces fluid-like rolling motion without storing previous frames.

- [ ] **Step 4: Add uniform family selection and conditional triple noise**

In `main`, replace the existing block beginning with `float fogA = fbm(p * 2.0 + flowDrift);` and ending with `vec2 warped = p + vec2(fogA - 0.5, fogB - 0.5) * 0.34;` with:

```glsl
  bool collisionFamily = variant < 2;
  bool weaveFamily = variant >= 2 && variant < 4;
  bool vortexFamily = variant >= 4;
  float fogA = fbm(p * 2.0 + flowDrift);
  float fogB = fbm(p * 3.2 + vec2(-flowDrift.y, flowDrift.x) * 0.82 + vec2(7.3));
  float fogC = 0.5;
  if(weaveFamily){
    fogC = fbm(p * 4.1 + vec2(-flowDrift.x * 0.68, flowDrift.y * 0.92) + vec2(13.7, 4.9));
  }
  vec2 warped = p + vec2(fogA - 0.5, fogB - 0.5) * 0.34;
```

Do not change `flowDrift`, `travelDrift`, or `macroDrift`. Because `variant` is a uniform, every pixel follows the same branch and variants 0–1 and 4–5 do not evaluate `fogC` at runtime.

- [ ] **Step 5: Apply one family-specific deformation after existing variant geometry**

Keep the six current `if(variant == N)` geometry blocks. Immediately after the `if(variant == 5)` block and before `float horizontalScale`, insert:

```glsl
  if(collisionFamily){
    float impact = fogA - fogB;
    shape += vec2(impact * (variant == 0 ? 0.42 : 0.30), (fogA + fogB - 1.0) * 0.18);
  }
  if(weaveFamily){
    vec2 braid = vec2(fogC - fogB, fogA - fogC);
    shape += braid * (variant == 2 ? 0.34 : 0.43);
  }
  if(vortexFamily){
    vec2 primaryCenter = variant == 4 ? vec2(0.20, 0.02) : vec2(0.44, 0.08);
    vec2 vortexFlow = vortexWarp(shape, primaryCenter, 0.82 + fogA * 0.34, 0.72);
    if(variant == 5){
      vortexFlow += vortexWarp(shape, vec2(0.92, -0.20), -0.72 - fogB * 0.28, 1.05);
      vortexFlow += vortexWarp(shape, vec2(-0.18, 0.28), 0.44, 1.30);
    }
    shape += vortexFlow + vec2(fogA - fogB, fogB - 0.5) * 0.16;
  }
```

- [ ] **Step 6: Feed the third field into the weave alphas**

Replace the four `layerAlpha` declarations with:

```glsl
  float detailC = weaveFamily ? fogC : fogB;
  float layerAlphaA = smoothstep(0.02, 0.82, cloudA) * leftFade * (0.74 + fogA * 0.26);
  float layerAlphaB = smoothstep(0.02, 0.82, cloudB) * leftFade * (0.72 + fogB * 0.28);
  float layerAlphaC = smoothstep(0.02, 0.82, cloudC) * leftFade * (0.76 + detailC * 0.24);
  float layerAlphaD = smoothstep(0.02, 0.82, cloudD) * leftFade * (0.74 + mix(fogA, detailC, 0.5) * 0.26);
```

- [ ] **Step 7: Replace generic overlap boosting with family compositing**

Replace the block beginning with `float smokeDensity = max(max(layerAlphaA, layerAlphaB), max(layerAlphaC, layerAlphaD));` and ending with `outColor = vec4(color, 1.0);` with:

```glsl
  float smokeDensity = max(max(layerAlphaA, layerAlphaB), max(layerAlphaC, layerAlphaD));
  float strength = (collisionFamily ? 0.60 : 0.48) + intensity * 0.30;

  vec3 color = vec3(0.985);
  color = mix(color, colorA, layerAlphaA * strength);
  color = mix(color, colorB, layerAlphaB * strength);
  color = mix(color, mix(colorA, colorB, 0.30), layerAlphaC * strength * 0.88);
  color = mix(color, mix(colorA, colorB, 0.72), layerAlphaD * strength * 0.84);

  float fieldA = max(layerAlphaA, layerAlphaC);
  float fieldB = max(layerAlphaB, layerAlphaD);
  float overlapInk = min(fieldA, fieldB);
  float collisionMask = smoothstep(0.12, 0.68, overlapInk);
  float fusionMask = (1.0 - smoothstep(0.02, 0.26, abs(fieldA - fieldB))) * smokeDensity;
  float pairwiseWeave = max(min(layerAlphaA, layerAlphaB), max(min(layerAlphaB, layerAlphaC), min(layerAlphaC, layerAlphaA)));
  float threeWayWeave = min(layerAlphaA, min(layerAlphaB, layerAlphaC));

  vec3 mixedInk = mix(colorA, colorB, 0.50);
  float mixedLight = dot(mixedInk, vec3(0.299, 0.587, 0.114));
  vec3 collisionInk = clamp(mix(vec3(mixedLight * 0.78), mixedInk, 1.42), 0.0, 1.0);

  if(collisionFamily){
    color = mix(color, mix(colorA, colorB, 0.50 + (fogA - fogB) * 0.18), fusionMask * 0.20);
    color = mix(color, collisionInk, collisionMask * (0.22 + intensity * 0.26));
  }
  if(weaveFamily){
    vec3 braidColor = mix(mix(colorA, colorB, fogC), collisionInk, 0.22);
    color = mix(color, braidColor, pairwiseWeave * 0.20);
    color = mix(color, collisionInk * 0.88, threeWayWeave * (0.20 + intensity * 0.16));
  }
  if(vortexFamily){
    float filament = smoothstep(0.12, 0.62, abs(fogA - fogB)) * smokeDensity;
    color = mix(color, mix(colorA, colorB, fogA), filament * 0.16);
    color = mix(color, collisionInk, collisionMask * 0.18);
  }

  color = mix(vec3(0.985), color, 0.88 + smokeDensity * 0.12);
  outColor = vec4(color, 1.0);
```

- [ ] **Step 8: Run focused tests and the production build**

Run:

```powershell
node --test tests/card-core.test.mjs
npm run build
```

Expected: all core tests PASS; build exits `0` with no GLSL-related TypeScript or bundling error.

- [ ] **Step 9: Commit the shader-family implementation**

```powershell
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add three ink flow families"
```

### Task 2: Add whole-card hover feedback

**Files:**
- Modify: `tests/rendered-html.test.mjs:1-55`
- Modify: `app/globals.css:137-153,329-332`

**Interfaces:**
- Consumes: the existing `.preview-card` class and the platform media features `hover`, `pointer`, and `prefers-reduced-motion`.
- Produces: CSS-only hover behavior; no React state, event handler, new prop, or pointer uniform.

- [ ] **Step 1: Write the failing stylesheet test**

Add this import beside the current Node imports:

```js
import { readFile } from "node:fs/promises";
```

Append this test after the server-render test:

```js
test("the whole card lifts on precise-pointer hover and respects reduced motion", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(
    css,
    /\.preview-card:hover\s*\{[^}]*transform:\s*translateY\(-6px\) scale\(1\.015\)/s,
  );
  assert.match(
    css,
    /\.preview-card:hover\s*\{[^}]*box-shadow:/s,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.preview-card:hover\s*\{\s*transform:\s*none;/,
  );
});
```

- [ ] **Step 2: Run the rendered-page tests and verify failure**

Run:

```powershell
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: the existing server-render test PASSes and the new hover test FAILs because the pointer-hover media query and card transform are absent.

- [ ] **Step 3: Extend the card transition and add precise-pointer hover**

In `.preview-card`, replace `transition: border-radius .25s ease;` with:

```css
  transition:
    transform .26s cubic-bezier(.2, .75, .25, 1),
    box-shadow .26s ease,
    border-radius .25s ease;
  will-change: transform;
```

Immediately after the `.preview-card` rule, add:

```css
@media (hover: hover) and (pointer: fine) {
  .preview-card:hover {
    transform: translateY(-6px) scale(1.015);
    box-shadow:
      0 34px 74px rgba(27, 29, 35, .16),
      0 8px 18px rgba(27, 29, 35, .10);
  }
}
```

- [ ] **Step 4: Disable movement for reduced-motion users**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, after the universal transition rule, add:

```css
  .preview-card:hover {
    transform: none;
    box-shadow: 0 24px 64px rgba(27, 29, 35, .11), 0 3px 5px rgba(27, 29, 35, .07);
  }
```

- [ ] **Step 5: Run the hover test and complete suite**

Run:

```powershell
npm run build
node --test tests/rendered-html.test.mjs
npm test
```

Expected: the two rendered-page tests PASS; the full build and all core/rendered tests PASS.

- [ ] **Step 6: Commit the hover implementation**

```powershell
git add app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: lift the preview card on hover"
```

### Task 3: Regression and browser visual verification

**Files:**
- Verify: `app/card-core.ts`
- Verify: `app/globals.css`
- Verify: `app/page.tsx`
- Verify: `tests/card-core.test.mjs`
- Verify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: the finished shader and CSS behavior from Tasks 1–2.
- Produces: evidence that the one-canvas page remains functional and each family looks distinct in a real WebGL2 browser.

- [ ] **Step 1: Run static verification**

```powershell
git diff --check
npm run lint
npm test
git status --short
```

Expected: `git diff --check`, lint, and tests exit `0`; status contains no uncommitted implementation changes.

- [ ] **Step 2: Open the local demo and verify structural invariants**

Use the in-app browser at `http://localhost:3000/`. Inspect the page and confirm:

- exactly one `.preview-card` and one `canvas` exist;
- the card's computed dimensions are 400×100 at a desktop viewport;
- its grid columns resolve to 35% / 65%;
- the console has no shader compile, WebGL context, React, or runtime errors.

- [ ] **Step 3: Verify one representative from each family**

Select styles 01, 03, and 05 in sequence, observing each for at least three seconds:

- 01: two broad fields advance toward each other, with a visibly darker collision and translucent fusion region;
- 03: three scales/directions form layered crossings and occasional darker three-way knots;
- 05: a broad rolling vortex bends and stretches the ink without turning into fine texture;
- none visibly snaps back to an initial shape after 1–2 seconds.

- [ ] **Step 4: Verify all six variants and randomization**

Select all six tabs and confirm 01/02, 03/04, and 05/06 are related within their families but visibly different from their pair. Click the randomize button twice and confirm colors, seeds, and motion presets change while the card remains 400×100 and its copy remains unchanged.

- [ ] **Step 5: Verify whole-card hover**

Record the `.preview-card` bounding rectangle and computed `box-shadow`, move the pointer anywhere over the text or visual portion, and record them again. Expected: the visual top moves upward by approximately 6px, the shadow becomes stronger, no surrounding control changes position, and pointer exit restores the resting values.

- [ ] **Step 6: Verify pause/play and reduced motion**

Pause and confirm consecutive screenshots are unchanged; resume and confirm flow continues. Emulate `prefers-reduced-motion: reduce`, reload, and confirm animation starts paused and card hover does not translate or scale.

- [ ] **Step 7: Report results**

If every check passes, report the exact test count, build/lint status, one-canvas count, and the three observed family behaviors. If a check fails, return to the task that owns the behavior, add the smallest regression test that reproduces it, fix it, rerun that task's checks, and make a focused commit before repeating this verification task.
