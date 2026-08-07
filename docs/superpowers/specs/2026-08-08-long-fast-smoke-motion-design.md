# Long, fast smoke motion design

## Goal

Keep the existing 400×100 single-canvas card while making its smoke feel fast locally, long-running globally, wider in travel, and more horizontally extended.

## Motion design

- Change the shared animation time scale from `5` to `8` for fast local surging.
- Split shader motion into two clocks:
  - `flowTime` uses the full scaled time for fast noise and internal smoke movement.
  - `travelTime` uses a much slower factor for macro drift, producing an obvious-repeat period of roughly 25–35 seconds.
- Increase horizontal macro-drift amplitude to about `1.8×` the current travel distance.
- Stretch each cloud layer horizontally to about `1.4×` its current visual length.
- Preserve the six variant-specific structures and their random preset speed differences.

## Rendering constraints

- Keep the card at exactly 400×100 and preserve the 35% copy / 65% visual split.
- Keep one WebGL canvas, the current fragment resolution, and the existing two FBM noise evaluations.
- Do not add noise octaves, texture assets, animation controls, dependencies, or new uniforms.
- Keep pause/play, randomize, reset, and reduced-motion behavior unchanged.

## Data flow

`requestAnimationFrame timestamp → seconds → preset speed → 8× shared scale → shader time`

Inside the shader, the time value branches into fast `flowTime` and slow `travelTime`. Flow drives turbulence; travel drives long-distance cloud-center movement. Horizontal cloud scaling is applied immediately before the four cloud masks are calculated.

## Verification

- Regression tests assert the shared time scale is `8` and the embed path uses it.
- Shader-source tests assert separate flow/travel clocks and a common horizontal stretch are present without increasing FBM octave count.
- Full build and tests must pass.
- Local-browser checks confirm one canvas, no WebGL errors, working pause/play, rapid short-interval frame changes, and clearly longer travel across a multi-second observation.

