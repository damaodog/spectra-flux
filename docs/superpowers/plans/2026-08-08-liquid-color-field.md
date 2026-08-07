# Diffused Liquid Color Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the reference image with a full-bleed, horizontally flowing liquid color field instead of separate circular smoke masses.

**Architecture:** Keep every existing public interface and control. Replace only `FRAGMENT_SHADER.main()` so both local preview and copied HTML use the same two broad warped color boundaries; derive a soft third tone from the two existing colors rather than adding state or controls.

**Tech Stack:** TypeScript, Node test runner, WebGL2, GLSL, React/Vinext.

## Global Constraints

- Local-only work; do not call or update Sites.
- Random generation changes visual parameters only; copy remains unchanged.
- Use 2–3 broad full-bleed color areas, not isolated circular masses.
- Keep a milky-white transition at the left of the visual area.
- Keep the right edge colored at all times with no white hole.
- Motion is slow horizontal sliding plus boundary deformation.
- Do not add dependencies, uniforms, components, or controls.

---

### Task 1: Replace smoke masses with a liquid color field

**Files:**
- Modify: `tests/card-core.test.mjs`
- Modify: `app/card-core.ts`

**Interfaces:**
- Consumes: existing `resolution`, `time`, `seed`, `intensity`, `colorA`, and `colorB` uniforms.
- Produces: the existing `FRAGMENT_SHADER` export; no TypeScript API changes.

- [ ] **Step 1: Write the failing liquid-field test**

Replace the smoke-specific assertion with:

```js
test("the fragment shader renders a full-bleed liquid color field", () => {
  assert.match(FRAGMENT_SHADER, /float liquidBoundary\s*=/);
  assert.match(FRAGMENT_SHADER, /float rightCoverage\s*=/);
  assert.match(FRAGMENT_SHADER, /vec3 fieldColor\s*=/);
  assert.doesNotMatch(FRAGMENT_SHADER, /smokeDensity|cloudA|cloudB|cloudC|cloudD/i);
});
```

- [ ] **Step 2: Run the core test and verify RED**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because the current shader still uses four smoke cloud distance fields and does not define liquid boundaries.

- [ ] **Step 3: Implement the full-bleed liquid shader**

Keep the existing uniforms and noise helpers. Replace `main()` with:

```glsl
void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float phase = seed * 0.013;
  float slide = time * 0.10;
  float lowField = fbm(vec2(uv.x * 1.35 - slide, uv.y * 1.65 + phase));
  float highField = fbm(vec2(uv.x * 2.25 + slide * 0.72 + 5.4, uv.y * 2.4 - phase));
  float verticalFlow = sin(uv.y * 3.4 + time * 0.32 + phase) * 0.055;
  float liquidBoundary = uv.x + (lowField - 0.5) * 0.34 + verticalFlow;
  float secondBoundary = uv.x + (highField - 0.5) * 0.28 - verticalFlow * 0.7;
  float colorBand = smoothstep(0.40, 0.76, secondBoundary);
  vec3 middleTone = mix(colorA, colorB, 0.46);
  vec3 firstBlend = mix(colorA, middleTone, smoothstep(0.24, 0.58, liquidBoundary));
  vec3 fieldColor = mix(firstBlend, colorB, colorBand);
  float softVariation = smoothstep(0.30, 0.78, lowField * 0.68 + highField * 0.32);
  fieldColor = mix(fieldColor, mix(fieldColor, vec3(1.0), 0.18), softVariation * 0.28);
  float rightCoverage = smoothstep(0.05, 0.43, liquidBoundary + lowField * 0.06);
  float saturation = 0.76 + intensity * 0.20;
  vec3 color = mix(vec3(0.985), fieldColor, rightCoverage * saturation);
  outColor = vec4(color, 1.0);
}
```

This uses two broad warped boundaries instead of radial masks. At `uv.x = 1.0`, `rightCoverage` remains fully on, so the right edge stays colored. The low-frequency slide keeps deformation soft and horizontal.

- [ ] **Step 4: Run the core test and verify GREEN**

Run: `node --test tests/card-core.test.mjs`

Expected: all core tests pass.

- [ ] **Step 5: Run full verification**

Run: `npm test`

Expected: build succeeds and all tests pass.

- [ ] **Step 6: Verify the local page only**

Reload `http://localhost:3000/` and confirm: no WebGL errors; the visual has no circular white hole; color reaches the right edge; two playing frames differ; pause/play controls still work. Do not publish.

- [ ] **Step 7: Commit**

```bash
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: match reference liquid color field"
```
