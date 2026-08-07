# Three ink-flow modes and card hover design

## Goal

Evolve the existing 400×100 single-card preview from soft smoke into six stronger ink-in-water looks. Colors should collide, overlap with visible transparency, fuse at their boundaries, and remain in motion without snapping back to an obvious starting shape. Hovering anywhere on the card should lift the whole card and deepen its shadow.

## Visual families

The existing six numbered variants are divided into three rendering families while continuing to share one fragment shader and one WebGL canvas.

### 01–02: dual-noise collision

- Drive two large color fields in opposing directions.
- Distort each field with a different domain-warp path so their boundaries meet irregularly rather than sliding past as parallel bands.
- Derive collision and fusion masks from field intersection, minimum, and difference values.
- Make direct collisions more saturated and slightly darker, while nearby overlap remains translucent so both source colors stay legible.
- Variant 01 favors broad frontal impacts; variant 02 favors oblique shear and folded edges.

### 03–04: triple-noise interweaving

- Add a third independently scaled and directed field only for these variants.
- Combine coarse body motion, medium folds, and finer boundary distortion into visible front/middle/back layers.
- Use three-way intersections sparingly as dark ink knots, with two-way intersections producing softer translucent braids.
- Variant 03 favors long ribbon-like crossings; variant 04 favors denser folds and pockets.

### 05–06: fluid-like vortex flow

- Create a curl-like displacement field from animated noise and local gradients.
- Use the field to bend, pull, and roll broad color masses into eddies, suction points, and stretched ink filaments.
- Preserve large soft regions so the result stays close to the reference card rather than becoming fine procedural texture.
- Variant 05 favors a dominant rolling vortex; variant 06 favors multiple interacting eddies and stronger directional pull.
- This is a fluid-simulation look, not a stateful multi-pass Navier–Stokes solver. Avoiding feedback buffers keeps the one-card demo responsive.

## Shared composition and motion

- Keep the card at exactly 400×100 with the current 35% copy / 65% colored visual split.
- Preserve the current eight-times local flow speed, slow macro travel, horizontal extension, and continuously advancing drift.
- Keep the six palettes, seeds, speeds, and structures distinct when the user randomizes the visual.
- Maintain a soft white transition at the visual area's left edge and full color coverage at the right edge.
- Avoid isolated circular clouds, white holes, hard contours, particles, rings, and dense high-frequency texture.

## Whole-card hover feedback

- On pointer-capable devices, hovering anywhere on the card lifts it by approximately 6px, scales it to approximately 1.015, and increases the soft shadow.
- Use a 220–280ms eased transition for both entry and exit.
- Do not add 3D tilt or alter layout flow; the transform must not move surrounding controls.
- Under `prefers-reduced-motion: reduce`, remove lift and scale while allowing a subtle static shadow change.

## Rendering architecture and data flow

The page retains a single `WebGLPreview` and a single fragment shader. A variant uniform selects the rendering family. The shader keeps the shared time, palette, seed, resolution, and color-field inputs already used by the card.

`requestAnimationFrame → scaled continuous time → shared macro/local motion → variant family → color-field masks → palette mixing → one canvas`

- Variants 01–02 evaluate the two shared warped fields and collision masks.
- Variants 03–04 conditionally evaluate the third field and its pairwise/three-way masks.
- Variants 05–06 derive a vortex displacement before evaluating and mixing their color fields.
- The randomize action updates only visual presets; card copy and dimensions remain unchanged.

## Performance and fallback constraints

- Keep one WebGL context, one canvas, one draw call per frame, and no external texture assets or runtime dependencies.
- Do not introduce framebuffer ping-pong, simulation textures, multiple canvases, or CPU particle systems.
- Limit extra noise work to the variants that require it; the triple-field evaluation must not burden the dual-field variants.
- Keep the existing pause/play behavior and reduced-motion handling.
- If WebGL initialization or shader compilation fails, retain the existing static soft-gradient fallback; whole-card CSS hover may still operate.

## Verification

- Core tests assert the six variants map to the three intended families and preserve the current size, split, time scale, and randomization behavior.
- Shader-source tests assert dual-field collision masks, conditional third-field interweaving, vortex displacement, and continuous non-looping drift are present.
- Rendered-page tests assert a single canvas and whole-card hover/reduced-motion rules.
- The full test suite and production build must pass.
- Local-browser checks inspect variants 01, 03, and 05 as family representatives, then all six for visible differences, continuous motion, color overlap, console errors, and a single canvas.
- Browser interaction verifies that entering the card changes its vertical position and shadow without shifting surrounding layout, and leaving restores the resting state.

## Out of scope

This iteration does not add exporting, multiple simultaneous cards, true framebuffer-based fluid simulation, pointer-driven ink disturbance, new card copy, or deployment. It modifies only the local single-card visual and whole-card hover response.
