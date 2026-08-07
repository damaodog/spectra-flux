# Long, Fast Smoke Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local smoke surge at an 8× time scale while macro travel lasts roughly 25–35 seconds, covers about 1.8× more distance, and renders about 1.4× longer cloud forms.

**Architecture:** Keep the existing single time uniform and split it inside the fragment shader into fast flow and slow travel clocks. Reuse the existing two FBM evaluations; a common macro-drift vector increases travel distance and a common horizontal scale lengthens all four cloud masks.

**Tech Stack:** TypeScript, React 19, WebGL2/GLSL, Node test runner, vinext/Vite

## Global Constraints

- Keep the card exactly 400×100 with a 35% copy / 65% visual split.
- Keep one WebGL canvas and the existing fragment resolution.
- Set the shared time scale to exactly `8`.
- Use `travelTime = time * 0.025`, `macroDrift = travelDrift * 1.8`, and `horizontalScale = 1.0 / 1.4`.
- Do not add FBM evaluations, noise octaves, uniforms, controls, dependencies, or texture assets.
- Preserve six variants, preset speed differences, pause/play, randomize, reset, and reduced-motion behavior.

---

### Task 1: Split fast flow from long macro travel

**Files:**
- Modify: `tests/card-core.test.mjs`
- Modify: `app/card-core.ts`

**Interfaces:**
- Produces: `SMOKE_TIME_SCALE: 8`
- Produces in GLSL: `flowTime`, `travelTime`, `flowDrift`, `travelDrift`, `macroDrift`, and `horizontalScale`
- Consumes: the existing WebGL `time` uniform, safe shader seed, preset speed, four centers, and four scale vectors

- [ ] **Step 1: Write failing tests for speed, clock split, distance, length, and cost**

In `tests/card-core.test.mjs`, replace the existing five-times test with:

```js
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
```

Add this shader contract test:

```js
test("the shader separates fast flow from long travel without extra FBM work", () => {
  assert.match(FRAGMENT_SHADER, /float flowTime\s*=\s*time;/);
  assert.match(FRAGMENT_SHADER, /float travelTime\s*=\s*time \* 0\.025;/);
  assert.match(FRAGMENT_SHADER, /vec2 flowDrift\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 travelDrift\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 macroDrift\s*=\s*travelDrift \* 1\.8;/);
  assert.match(FRAGMENT_SHADER, /float horizontalScale\s*=\s*1\.0 \/ 1\.4;/);
  assert.equal((FRAGMENT_SHADER.match(/= fbm\(/g) || []).length, 2);
});
```

In the existing `"the fragment shader renders smoke without mixed effects"` test, replace its old `smokeDrift` assertion with:

```js
  assert.match(FRAGMENT_SHADER, /vec2 flowDrift\s*=/);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: FAIL because `SMOKE_TIME_SCALE` is still `5` and the split-clock shader identifiers do not exist.

- [ ] **Step 3: Change the shared scale to eight**

In `app/card-core.ts`, change:

```ts
export const SMOKE_TIME_SCALE = 8;
```

The live preview and embed generator already consume this shared constant, so no additional render-loop change is required.

- [ ] **Step 4: Split the shader clock and increase macro travel**

Replace the existing `smokeDrift` block and its two FBM inputs in `FRAGMENT_SHADER` with:

```glsl
  float flowTime = time;
  float travelTime = time * 0.025;
  vec2 flowDrift = vec2(
    sin(flowTime * 0.42 + phase),
    cos(flowTime * 0.34 - phase)
  );
  vec2 travelDrift = vec2(
    sin(travelTime + phase),
    cos(travelTime * 0.83 - phase)
  );
  vec2 macroDrift = travelDrift * 1.8;
  float fogA = fbm(p * 2.0 + flowDrift * 0.32);
  float fogB = fbm(p * 3.2 - flowDrift.yx * 0.25 + vec2(7.3));
```

Use `macroDrift` for all cloud-center movement. The default centers become:

```glsl
  vec2 centerA = vec2(-0.32, 0.16) + macroDrift * vec2(0.18, 0.10);
  vec2 centerB = vec2(0.08, -0.18) + macroDrift.yx * vec2(-0.13, 0.16);
  vec2 centerC = vec2(0.78, 0.12) + macroDrift.yx * 0.14;
  vec2 centerD = vec2(0.62, -0.38) - macroDrift * 0.12;
```

In every variant branch, replace center references to `smokeDrift` with `macroDrift`. In variant 2, use `flowTime` for its internal wave:

```glsl
      warped.x + sin(warped.y * 3.8 + flowTime * 0.24 + phase) * 0.16,
```

- [ ] **Step 5: Lengthen all cloud masks horizontally**

Immediately before calculating `cloudA` through `cloudD`, add:

```glsl
  float horizontalScale = 1.0 / 1.4;
  scaleA.x *= horizontalScale;
  scaleB.x *= horizontalScale;
  scaleC.x *= horizontalScale;
  scaleD.x *= horizontalScale;
```

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: all focused tests PASS, including exactly two FBM evaluations.

- [ ] **Step 7: Run full verification and local visual checks**

Run:

```powershell
$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'
npm test
git diff --check
```

Expected: build succeeds, all tests pass, and `git diff --check` prints no errors.

At `http://localhost:3000/`, verify exactly one canvas, no WebGL error, working pause/play, visible change within 200ms, broader multi-second travel, and horizontally longer smoke. Check styles 01, 02, and 06.

- [ ] **Step 8: Commit**

```powershell
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: extend fast smoke motion"
```
