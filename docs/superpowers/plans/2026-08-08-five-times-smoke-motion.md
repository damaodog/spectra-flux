# Five-times Smoke Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every smoke variant advance its WebGL animation time five times faster.

**Architecture:** Define one shared numeric time-scale constant in `card-core.ts`. Both the live React preview and the self-contained embed generator multiply elapsed shader time by that constant, preserving the existing preset speed differences and all rendering details.

**Tech Stack:** TypeScript, React 19, WebGL2/GLSL, Node test runner, vinext/Vite

## Global Constraints

- The shared smoke time scale is exactly `5`.
- Keep the current 400×100 card and one WebGL canvas.
- Do not add controls, canvases, shader layers, dependencies, or resolution changes.
- Preserve the existing random preset `speed` values.

---

### Task 1: Apply the shared five-times animation scale

**Files:**
- Modify: `tests/card-core.test.mjs`
- Modify: `app/card-core.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `SMOKE_TIME_SCALE: 5`, exported from `app/card-core.ts`
- Consumes: existing `CardConfig.speed`, `requestAnimationFrame` timestamps, and WebGL `time` uniforms

- [ ] **Step 1: Write the failing regression test**

Add `SMOKE_TIME_SCALE` to the imports in `tests/card-core.test.mjs`, then add:

```js
test("smoke animation uses the shared five-times scale", () => {
  assert.equal(SMOKE_TIME_SCALE, 5);

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

  assert.match(html, /now\*\.001\*0\.8\*5/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: FAIL because `app/card-core.ts` does not export `SMOKE_TIME_SCALE`.

- [ ] **Step 3: Add the shared scale and use it in both render paths**

In `app/card-core.ts`, add beside the existing exported constants:

```ts
export const SMOKE_TIME_SCALE = 5;
```

Update the generated embed draw function in `buildEmbed`:

```ts
gl.uniform1f(time,now*.001*${speed}*${SMOKE_TIME_SCALE});
```

In `app/page.tsx`, import `SMOKE_TIME_SCALE` and update the live uniform:

```ts
gl.uniform1f(
  uniforms.time,
  now * 0.001 * current.speed * SMOKE_TIME_SCALE,
);
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test tests/card-core.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 5: Run full verification**

Run:

```powershell
$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'
npm test
git diff --check
```

Expected: build succeeds, all tests pass, and `git diff --check` prints no errors.

In the local browser at `http://localhost:3000/`, verify one canvas remains mounted, pause/play still works, no WebGL error appears, and the smoke visibly surges about five times faster.

- [ ] **Step 6: Commit**

```powershell
git add app/card-core.ts app/page.tsx tests/card-core.test.mjs
git commit -m "feat: accelerate smoke motion five times"
```

