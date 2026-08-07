# Soft Smoke Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed WebGL effect with one soft colored smoke effect while keeping one-click randomization visual-only.

**Architecture:** Keep the existing page, controls, `CardConfig`, export builder, and single WebGL2 renderer. Replace only the shared fragment shader so local preview and copied HTML remain identical.

**Tech Stack:** TypeScript, Node test runner, WebGL2, GLSL, React/Vinext.

## Global Constraints

- Work locally only; do not call Sites or create a deployment.
- Random generation must not change title, subtitle, label, card size, or radius.
- The shader must render 3–5 soft fog masses with low-frequency noise and domain warp.
- No particles, ripples, veins, hard edges, or dark smoke.
- The smoke must visibly move while playing and remain still while paused.
- Preserve the static CSS gradient fallback.

---

### Task 1: Replace the mixed shader with soft smoke

**Files:**
- Modify: `tests/card-core.test.mjs`
- Modify: `app/card-core.ts`

**Interfaces:**
- Consumes: existing `time`, `seed`, `intensity`, `colorA`, `colorB`, and `resolution` uniforms.
- Produces: the existing `FRAGMENT_SHADER` export with smoke-only GLSL; no public TypeScript signature changes.

- [ ] **Step 1: Write the failing smoke-only test**

Add:

```js
test("the fragment shader renders smoke without mixed effects", () => {
  assert.match(FRAGMENT_SHADER, /float smokeDensity\s*=/);
  assert.match(FRAGMENT_SHADER, /vec2 smokeDrift\s*=/);
  assert.doesNotMatch(FRAGMENT_SHADER, /ripple|particles|veins|grain/i);
});
```

Remove the previous implementation-specific `flowWarp` test because smoke movement is now covered by `smokeDrift`.

- [ ] **Step 2: Run the core test and verify RED**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because the current shader has no `smokeDensity` or `smokeDrift` and still contains ripple, particles, and veins.

- [ ] **Step 3: Implement the minimal smoke shader**

Keep the existing uniform declarations plus `hash`, `noise`, and `fbm`. Replace `main()` with one smoke-only density field using this exact structure:

```glsl
void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float phase = seed * 0.013;
  vec2 smokeDrift = vec2(
    sin(time * 0.42 + phase),
    cos(time * 0.34 - phase)
  );
  float fogA = fbm(p * 2.0 + smokeDrift * 0.32);
  float fogB = fbm(p * 3.2 - smokeDrift.yx * 0.25 + 7.3);
  vec2 warped = p + vec2(fogA - 0.5, fogB - 0.5) * 0.34;
  vec2 centerA = vec2(-0.32, 0.16) + smokeDrift * vec2(0.18, 0.10);
  vec2 centerB = vec2(0.08, -0.18) + smokeDrift.yx * vec2(-0.13, 0.16);
  vec2 centerC = vec2(0.45, 0.12) + vec2(sin(time * 0.29 - phase), cos(time * 0.37 + phase)) * 0.14;
  vec2 centerD = vec2(0.28, -0.38) + vec2(cos(time * 0.31 + phase), sin(time * 0.27)) * 0.12;
  float cloudA = 1.0 - smoothstep(0.12, 0.62, length((warped - centerA) * vec2(0.72, 1.0)));
  float cloudB = 1.0 - smoothstep(0.10, 0.56, length((warped - centerB) * vec2(0.82, 1.0)));
  float cloudC = 1.0 - smoothstep(0.08, 0.50, length((warped - centerC) * vec2(0.76, 1.0)));
  float cloudD = 1.0 - smoothstep(0.08, 0.46, length((warped - centerD) * vec2(0.86, 1.0)));
  float smokeDensity = clamp((cloudA + cloudB + cloudC + cloudD) * (0.42 + fogA * 0.38 + fogB * 0.20), 0.0, 1.0);
  float colorMix = clamp(0.18 + uv.y * 0.28 + fogB * 0.62, 0.0, 1.0);
  vec3 smokeColor = mix(colorA, colorB, colorMix);
  float leftFade = smoothstep(0.03, 0.46, uv.x + fogA * 0.08);
  float opacity = smoothstep(0.04, 0.84, smokeDensity) * leftFade * (0.68 + intensity * 0.32);
  vec3 color = mix(vec3(0.985), smokeColor, opacity * 0.82);
  outColor = vec4(color, 1.0);
}
```

This keeps four soft masses, low-frequency motion, white left fade, and seed-driven composition without adding new uniforms or controls.

- [ ] **Step 4: Run the core test and verify GREEN**

Run: `node --test tests/card-core.test.mjs`

Expected: all core tests pass.

- [ ] **Step 5: Run full verification**

Run: `npm test`

Expected: the deployment build and all tests pass.

- [ ] **Step 6: Verify only the local page**

Reload `http://localhost:3000/`, confirm no WebGL error, confirm two playing frames differ, click pause and confirm the control changes to “播放”, then restore playback. Do not publish.

- [ ] **Step 7: Commit**

```bash
git add app/card-core.ts tests/card-core.test.mjs docs/superpowers/plans/2026-08-08-smoke-visual.md
git commit -m "feat: focus card visual on soft smoke"
```
