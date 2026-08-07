# Six-card atlas gallery design

## Goal

Replace the selectable single-card preview with six simultaneously animated cards in a two-column, three-row gallery. Preserve the six existing ink-flow variants while increasing every card's dynamic region from 65% to 75% of its width and reducing its copy to only `SPECTRA` and `COLOR AS A LIVING SYSTEM.`

## Layout and copy

- Render all six cards at once in source order 01–06.
- Use a two-column, three-row desktop grid with 400×100 cards and consistent horizontal and vertical gaps.
- Switch to one column when the viewport cannot comfortably fit two 400px cards plus the gap.
- Change every card to a 25% copy / 75% visual grid.
- Keep only the `SPECTRA` heading and `COLOR AS A LIVING SYSTEM.` subtitle inside each card.
- Remove the card label, seed row, renderer badge, per-style heading, and numbered style tabs.
- Keep the toolbar actions for randomizing all six cards, pausing/playing all animation, and resetting all presets.
- Preserve independent whole-card hover lift and shadow feedback.

## Rendering architecture

Use one detached WebGL2 source canvas as a six-cell render atlas and six lightweight visible 2D canvases, one inside each card.

- Create and compile one WebGL2 program.
- Size the source atlas as two visual columns by three visual rows, accounting for the display pixel ratio cap.
- For each frame, draw variants 0–5 into six atlas viewports using the existing fragment shader, palette, seed, speed, and intensity uniforms.
- After the six WebGL draw calls, copy each atlas cell into its matching visible 2D canvas with `drawImage`.
- Keep one WebGL context and one animation loop; do not create a WebGL context per card.
- Each visible canvas remains clipped by its own card's rounded visual container, so the existing card border and hover behavior remain simple CSS.

This deliberately uses six inexpensive 2D presentation canvases. A single visible canvas behind the entire gallery would make per-card rounded clipping and responsive reflow unnecessarily fragile.

## Components and data flow

`Home` owns the existing six `CardConfig` values and passes the complete array plus `playing` into a gallery renderer.

`requestAnimationFrame → six card presets → one WebGL atlas draw → six atlas cells → six visible 2D canvases`

- Randomize replaces the visual preset fields for all six configurations.
- Reset restores all six deterministic defaults.
- Pause stops the shared animation loop and preserves the last copied frames.
- Resume restarts the same shared loop.
- Card copy, dimensions, and variant ordering never change during randomization.

## Performance constraints

- Keep exactly one WebGL2 context and one shader program.
- Use six draw calls and six 2D blits per animated frame.
- Cap device pixel ratio at the current value of 2; lower it only if browser verification shows the six-card gallery is not smooth.
- Do not add framebuffer feedback, textures, particles, dependencies, workers, or multiple animation loops.
- Skip drawing while the document is hidden and retain the existing reduced-motion pause behavior.

## Error handling and fallback

- If WebGL2 creation, shader compilation, or program linking fails, stop the shared animation loop.
- Keep the existing per-card CSS gradient backgrounds visible beneath the 2D canvases.
- Do not render WebGL error badges inside cards because card copy is restricted to the two requested text lines.

## Verification

- Core tests preserve six deterministic variants, 400×100 dimensions, the shared eight-times time scale, and all three ink-flow families.
- Rendered-page tests assert six cards, six visible canvases, no style tabs, no card label/seed/renderer badge, and the 25% / 75% split.
- Source tests assert there is one WebGL2 context creation, one animation loop, six atlas draw iterations, and six 2D presentation blits.
- Full production build and test suite must pass.
- Local-browser checks confirm two columns by three rows at desktop width, one column at narrow width, six distinct moving cards, one WebGL context, working randomize/pause/reset, independent hover feedback, and no runtime or shader error.

## Out of scope

This iteration does not add export, publishing, per-card controls, pointer-driven ink disturbance, true feedback-buffer fluid simulation, or new card text. It changes only the local gallery presentation and the shared rendering pipeline required to display all six variants simultaneously.
