# Single-card random mix lab design

## Goal

Add a dedicated single-card creation page to SPECTRA FLUX. The user chooses only how many motion studies to combine. Every other visual decision is randomized, producing one continuously animated `400 × 100` card that remains consistent with the existing editorial layout and WebGL visual language.

This page is a focused visual laboratory, not a full parameter editor. It should make complex combinations feel immediate while preserving enough recipe information for the user to understand each result.

## Confirmed product constraints

- Add the creator as a new page instead of replacing the existing 72-study gallery.
- The only generative choice is effect count: `2`, `3`, `4`, `5`, or `6`.
- Effect identities, layer seeds, interaction modes, speed behavior, palette, direction, scale, and weights are randomized.
- Selected effects run and interact simultaneously. There is no transition animation between the old and new random results.
- The card remains exactly `400 × 100px`, with approximately 25% copy and 75% animated color area.
- Keep the card copy `SPECTRA` and `COLOR AS A LIVING SYSTEM.`
- The whole card keeps the existing hover lift and stronger shadow.
- The generated recipe is visible but read-only.

## Route and navigation

- Add a dedicated `/lab` route.
- Add a restrained “随机实验室” navigation entry to the existing site chrome.
- Preserve the current white background, black and gray typography, rounded controls, thin borders, and editorial spacing.
- The gallery remains the primary catalog; the lab is the single-result companion experience.

## Page layout

### Desktop

Use a two-column composition:

- The left column contains a short introduction, a segmented effect-count selector, and the primary randomize button.
- The right column centers one `400 × 100px` card without scaling it above its intended display size.
- A compact read-only recipe sits below the card and may wrap onto multiple lines.
- A secondary pause/continue control is available for inspection but does not alter or regenerate parameters.

### Narrow screens

- Stack the controls above the preview.
- Preserve the 4:1 aspect ratio and fit the card within the available viewport width when the viewport is narrower than 400px.
- Keep touch targets at least 44px high.

## User flow

1. Open `/lab` from the main navigation.
2. Choose an effect count from 2 through 6.
3. Press “一键随机创作”.
4. The current recipe is replaced immediately by a new composition using that number of unique effects.
5. Observe the animated result and its read-only recipe.
6. Pause or continue the animation when needed.
7. Repeat without retaining or locking individual parameters.

The initial page load generates one seeded random composition so the canvas is never empty. The production UI chooses that seed automatically; tests may inject a fixed seed for reproducibility.

## Effect selection

The source pool is the existing 72 motion studies in six families:

- 01–12: 雾与薄纱
- 13–24: 光学材质
- 25–36: 流体力场
- 37–48: 晶体生长
- 49–60: 电磁脉冲
- 61–72: 天体引力

Selection rules:

- Never select the same study more than once in a recipe.
- Favor cross-family combinations so the layers contribute distinct spatial behavior.
- Keep a smaller chance of selecting two studies from the same family for cohesive, quieter results.
- Down-weight pairs with nearly identical structural signatures, speeds, or dominant masks.
- Preserve every study's identity strongly enough for the result to feel composed rather than averaged into generic noise.

## Multi-effect interaction model

All selected effects are evaluated inside one fragment shader and one WebGL draw. A compile-time maximum of six layers keeps the shader structure predictable. The chosen effect count determines how many layers are active.

Each active layer contributes:

- study/kernel identity;
- independent seed;
- spatial scale and direction;
- continuously accumulated local time;
- minimum and maximum speed;
- speed-modulation seed and frequency;
- one or two palette references;
- density, boundary, displacement, and light fields;
- normalized composition weight.

Adjacent active layers receive one randomized interaction mode. These interactions must operate on coordinates, masks, density, or boundaries—not merely alpha-composite finished colors.

### Interaction modes

1. **Fusion / 融合** — smoothly merges density fields and emphasizes shared interior regions.
2. **Collision / 碰撞** — strengthens opposing boundaries and creates saturated or slightly darker impact seams.
3. **Interweave / 交缠** — alternates layer dominance using broad warped masks, producing ribbons and braids.
4. **Engulf / 吞噬** — uses one layer's density and displacement to erode or pull another layer.
5. **Light blend / 光叠** — uses controlled screen-like light mixing for luminous optical combinations.
6. **Difference cut / 差异切割** — exposes field differences as moving cut lines without high-frequency strobing.

Later layers may also perturb the sampling coordinates of earlier accumulated fields. This creates visible mutual influence and avoids the appearance of independent transparent animations stacked on top of one another.

As effect count increases, per-layer contribution is normalized and contrast compression becomes stronger. Five- and six-layer recipes must remain legible, avoid clipping, and avoid collapsing into gray.

## Random speed field

Speed is not a fixed slow-to-fast preset. Every layer receives its own continuously changing velocity.

- Randomly choose safe minimum and maximum speed bounds per layer.
- Ensure a meaningful gap between the two bounds.
- Drive instantaneous speed with low-frequency smooth noise inside those bounds.
- Add occasional eased surge envelopes for short accelerations and slower buildup phases.
- Offset modulation seeds and periods so layers do not accelerate together.
- Integrate velocity into accumulated time; never derive animation position directly from a changing multiplier.
- Keep velocity positive. Layers may slow down substantially but do not reverse direction.
- Clamp acceleration and maximum velocity to prevent flashing, temporal aliasing, or unstable motion.

This model produces irregular bursts, pauses, and staggered rhythms while keeping motion continuous and non-looping.

## Palette generation

Each recipe contains a coordinated palette of three to six colors. The generator randomly selects one palette strategy:

- analogous haze;
- warm/cool collision;
- restrained triadic interweaving;
- dominant color with small bright accent;
- low-saturation body with saturated ink flow.

Color rules:

- Assign related palette entries to nearby layers instead of independently sampling arbitrary colors.
- Keep sufficient hue or luminance separation for collision boundaries to remain visible.
- Apply saturation and luminance compression after multi-layer mixing to prevent muddy gray, overexposure, and clipped neon.
- Preserve the soft white transition at the left side of the visual region and strong color coverage toward the right.
- Keep the overall background and copy area white.

## Recipe display

The recipe is informational and cannot be edited. It includes:

- selected study numbers and Chinese names;
- interaction modes in evaluation order;
- palette swatches;
- each layer's rounded minimum–maximum speed range.

Example:

`03 薄纱 × 28 涡流 × 54 电弧 / 交缠 + 碰撞`

The display should remain visually secondary to the card and controls.

## Rendering architecture

Retain the existing single-context philosophy:

`effect count → seeded recipe generator → six lightweight phase clocks → packed layer uniforms → one fragment shader → one 400 × 100 canvas`

- Use one WebGL2 context, one canvas, and one draw call per frame.
- Refactor reusable motion-study field evaluation so it can return structured field data for multiple layers.
- Use fixed-size uniform arrays for up to six layers and an active-layer count uniform.
- Maintain one accumulated phase clock per active layer in the page renderer. Each frame samples that layer's smooth bounded velocity, integrates `phase += deltaTime × velocity`, and uploads the six phase values through one reused typed array.
- Clamp frame delta after inactive tabs or debugger pauses so accumulated phase never jumps forward dramatically.
- Implement interaction modes in GLSL using integer mode identifiers.
- Cap device pixel ratio so a visually small card does not create unnecessary fragment work.
- Avoid multiple canvases, CSS blend stacks, CPU particles, external textures, and framebuffer ping-pong.
- Pause rendering when the page is hidden and respect the explicit pause/continue control.

## State model

The page maintains:

- selected effect count;
- current generated recipe;
- play/pause state;
- WebGL availability/error state.

Changing the effect-count selector does not partially mutate the current card. A new recipe is produced only when the user presses the primary randomize button. This makes the action predictable.

The random generator should be seed-driven internally so tests can reproduce recipes even though the UI does not expose a seed control.

## Hover and motion preferences

- Hovering anywhere on the card lifts it by approximately 6px and deepens its soft shadow.
- Do not add 3D tilt or pointer-driven shader disturbance.
- Under `prefers-reduced-motion: reduce`, do not auto-animate the shader; show a stable generated frame and remove lift/scale motion while allowing a subtle shadow-state change.

## Failure handling

- If WebGL2 initialization or shader compilation fails, show a static gradient derived from the generated palette.
- Keep controls operational so a user can still see new palette combinations.
- Surface a small non-blocking “静态预览” status instead of a technical error dump.
- Never leave the preview blank.

## Performance constraints

- Target smooth animation on the same local browser that renders the current gallery.
- Render only one card and one canvas on the lab page.
- Keep a fixed maximum of six active layers.
- Skip inactive layer work using the active-layer count.
- Keep effect-specific expensive calculations behind active kernel branches.
- Avoid allocating objects or uniform arrays on every animation frame.
- Reuse typed buffers. Upload static recipe data only after randomization; during animation, update only the shared global time and six accumulated phase values.

## Verification

### Unit tests

- Effect count remains within 2–6 and matches the user's selection.
- Every recipe contains unique study IDs.
- Cross-family weighting and same-family fallback operate deterministically for a fixed seed.
- Every layer has valid minimum/maximum speed bounds with `min < max`.
- Interaction modes and palette entries remain within supported ranges.
- Layer weights are normalized according to effect count.
- Fixed seeds reproduce identical recipes.

### Shader/source tests

- The renderer and shader support six fixed layer slots and an active-layer count.
- All six interaction modes are represented.
- Per-layer phase is integrated from smooth bounded velocity rather than calculated by applying a changing multiplier to absolute time.
- Inactive layers do not evaluate expensive motion kernels.
- The existing white-to-color card composition remains present.

### Rendered-page tests

- `/lab` renders exactly one canvas and one card.
- Effect-count controls expose 2–6.
- The card copy, 4:1 ratio, 25/75 split, recipe area, randomize button, and pause control are present.
- Whole-card hover and reduced-motion rules are present.
- Main-site navigation links to `/lab`, and `/lab` links back to the gallery.

### Browser verification

- Generate representative 2-, 4-, and 6-layer recipes.
- Confirm effects visibly interact rather than appearing as independent translucent overlays.
- Observe independent irregular speed changes for at least 20 seconds without jumps, reversal, or resetting to a starting shape.
- Confirm five- and six-layer results avoid muddy gray and overexposure.
- Verify randomization, pause/continue, hover lift, narrow-screen layout, fallback state, and console output.
- Check that animation remains responsive and the page contains a single WebGL context.

## Out of scope

- Locking individual effects, colors, speeds, or interaction modes.
- Manual layer editing, reordering, or weight sliders.
- Exporting image, video, code, or embed snippets.
- Saving favorites, history, accounts, or cloud persistence.
- Sharing a recipe URL.
- Stateful multi-pass fluid simulation or framebuffer feedback.
- Pointer-driven deformation inside the visual field.
