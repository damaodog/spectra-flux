# Five-times smoke motion design

## Goal

Make all six smoke variants surge and flow five times faster while preserving the current 400×100 card, one-canvas rendering, color layering, image quality, and 60 FPS animation loop.

## Design

- Add one shared smoke time-scale constant with a value of `5`.
- Multiply elapsed animation time by this constant before sending it to the shader.
- Keep each preset's existing random `speed` value, so the six variants retain their relative timing differences.
- Apply the same multiplier to the legacy self-contained embed generator so both render paths stay consistent.
- Do not add a speed control, new canvas, shader layer, or rendering dependency.

## Data flow

`requestAnimationFrame timestamp → seconds → preset speed → 5× time scale → WebGL time uniform`

Only the time uniform changes. Shader geometry, noise sampling, colors, intensity, and resolution remain unchanged.

## Verification

- A unit regression test asserts the shared time scale is exactly `5` and the embed path uses it.
- The full build and test suite must pass.
- Local-browser checks confirm one canvas, no WebGL errors, working pause/play, and visibly faster motion.

