# Thirty-Six Motion Atlas Design

## Goal

Expand the local SPECTRA WebGL gallery from twelve to thirty-six named motion studies. Show twelve cards per page, preserve the user's selected studies 01, 03, 05, and 11 exactly, and make the remaining studies materially different from flat gradients or undifferentiated colored clouds.

The result remains local at `http://localhost:3000/`. Export and hosting stay out of scope.

## Approved Direction

The collection uses three curated chapters instead of randomly mixing all effects:

1. `01–12 · 雾与薄纱`
2. `13–24 · 光学材质`
3. `25–36 · 流体力场`

The visual language may go beyond literal smoke while retaining the soft, premium abstraction of the reference: silk, refraction, oil film, magnetic fluid, glow, caustics, interference, and translucent material motion are allowed. Particles, glitch graphics, hard geometric scanning, and noisy digital effects are excluded.

## Preserved Studies

These studies keep their current shader behavior, speed, identity, and numbering:

- 01 · 柔雾扩散 (`variant 0`)
- 03 · 横向薄纱 (`variant 2`)
- 05 · 斜向漂移 (`variant 4`)
- 11 · 急速奔流 (`variant 10`)

Randomization may update their palette, seed, and fine detail in the same way it does today, but must not replace their motion structure.

## Collection

### Page 1 — 雾与薄纱

| No. | Name | Motion identity |
| --- | --- | --- |
| 01 | 柔雾扩散 | Preserve existing broad translucent diffusion. |
| 02 | 薄纱碰撞 | Two horizontal veils enter from opposite directions and compress into a turbulent seam. |
| 03 | 横向薄纱 | Preserve existing layered horizontal weave. |
| 04 | 薄纱断层 | Parallel layers slip at different speeds with soft discontinuities. |
| 05 | 斜向漂移 | Preserve existing diagonal drifting field. |
| 06 | 丝流拉伸 | Long filaments stretch, thin, and reconnect across the card. |
| 07 | 双层回流 | Upper and lower bands counter-flow and curl back at their boundary. |
| 08 | 绸带折返 | A wide ribbon folds back on itself with translucent overlap. |
| 09 | 墨丝破浪 | Fine ink threads cut through a slower broad wave. |
| 10 | 层云错位 | Large cloud strata translate at unequal rates to create parallax. |
| 11 | 急速奔流 | Preserve existing fast horizontal rush. |
| 12 | 慢纱呼吸 | Layer widths and opacity inhale and exhale without resetting shape. |

### Page 2 — 光学材质

| No. | Name | Motion identity |
| --- | --- | --- |
| 13 | 油膜涌色 | Iridescent color domains drift along thin-film boundaries. |
| 14 | 液态折射 | A soft lens field bends underlying color bands. |
| 15 | 珠光流变 | Pearlescent highlights travel across a viscous translucent body. |
| 16 | 玻璃焦散 | Curved caustic lines focus and relax over milky glass. |
| 17 | 极光薄层 | Several luminous translucent curtains rise at different depths. |
| 18 | 色散棱镜 | A moving refraction ridge separates and recombines adjacent hues. |
| 19 | 乳浊晕光 | Diffuse inner glow blooms through a cloudy material. |
| 20 | 云母闪流 | Broad mineral-like planes catch light in slow directional sweeps. |
| 21 | 偏振波纹 | Soft interference bands rotate and phase-shift without hard stripes. |
| 22 | 柔焦色蚀 | Color softly recedes from irregular edges and returns through diffusion. |
| 23 | 透明胶质 | Rounded gel masses stretch, merge, and recover with visible depth. |
| 24 | 光雾虹吸 | A luminous current pulls surrounding haze through a narrow channel. |

### Page 3 — 流体力场

| No. | Name | Motion identity |
| --- | --- | --- |
| 25 | 磁流体脉冲 | Dense ridges gather around a moving field and release in pulses. |
| 26 | 涡环撞击 | Two vortex rings approach, deform, and exchange momentum. |
| 27 | 张力裂隙 | A soft fluid sheet opens and heals along a moving tension line. |
| 28 | 双场吞吐 | Two opposing density fields alternately absorb and emit color. |
| 29 | 密度坍缩 | A wide volume contracts into a dark core before dispersing sideways. |
| 30 | 液面干涉 | Crossing waves create transient cells that drift and dissolve. |
| 31 | 环形扩散 | Off-center rings expand through fog with non-uniform edges. |
| 32 | 相位潮汐 | Several slow wavefronts phase in and out across the width. |
| 33 | 逆向卷吸 | A main flow advances while thin boundary currents pull backward. |
| 34 | 细胞融汇 | Soft cellular regions share boundaries, merge, and separate. |
| 35 | 纤维风暴 | Dense curved filaments sweep quickly around a broad center. |
| 36 | 深海呼吸 | Deep low-frequency volumes rise and sink with restrained luminous edges. |

## Rendering Architecture

- Keep one WebGL2 context and one hidden atlas canvas.
- Render only the active page's twelve studies into a `2 × 6` atlas.
- Copy the twelve atlas cells into twelve visible 2D canvases.
- Store all thirty-six definitions in application state, but pass only the active page slice to the atlas renderer.
- Keep the current DPR ceiling of `1.5` for the twelve-card view.
- Pause animation when the document is hidden and honor reduced-motion preferences.

To avoid a monolithic thirty-six-branch shader, use a bounded set of reusable motion kernels with per-study parameters. The four preserved studies retain their existing paths. New studies combine reusable fields—multi-frequency noise, ribbons, lens gradients, caustics, vortex warps, phase waves, and soft signed-distance masks—through explicit kernel identities. Each study must have a recognizable silhouette or motion mechanism, not only a different palette.

## Page Behavior

- Add three page controls labeled `01–12`, `13–24`, and `25–36`.
- Switching pages changes the twelve studies without reloading the document.
- The active page control is visually distinct and exposed through `aria-current="page"`.
- Keep card labels outside the cards.
- Keep the card body limited to `SPECTRA` and `COLOR AS A LIVING SYSTEM.`
- Keep the `400 × 100` card size, two-column desktop layout, one-column responsive layout, whole-card hover lift, and shadow.
- One-click randomization updates palette, seed, and fine variation for all thirty-six studies. It does not change study order, name, kernel, or semantic speed.
- Pause/play applies to the current page and remains in the selected state while paging.
- Reset restores all thirty-six studies and returns to page 1.

## Visual Acceptance Criteria

- 36 unique numbered names exist; every page contains exactly 12 cards.
- Studies 01, 03, 05, and 11 match their current motion implementations.
- At least five of the eight replacement studies on page 1 clearly inherit 03's layered horizontal language, but do not look identical.
- Page 2 reads as optical/translucent material rather than ordinary smoke.
- Page 3 reads as force-driven motion rather than static gradients.
- No replacement study collapses into a nearly uniform two-color fill for its full cycle.
- Every active-page canvas continues changing while playing; slow studies may require a longer observation window.
- Page switching, randomization, pause/play, reset, and hover feedback work without shader warnings or errors.
- Desktop remains a two-column gallery and narrow viewports remain one column.

## Testing

- Core tests cover 36 stable study identities, semantic speeds, deterministic seed generation, preserved variant signatures, and 12-item pagination slices.
- Rendered HTML/source tests cover three page controls, exactly twelve mounted card canvases, card-external labels, one WebGL2 context, the dynamic atlas rows, and the DPR cap.
- Browser verification covers all three pages, exact labels, no console warnings/errors, page navigation, randomization, pause stability, resumed motion, hover lift, responsive layout, and screenshots of all 36 studies.

## Non-Goals

- Image/video export
- Public deployment or Sites hosting
- Per-card text editing
- More than twelve simultaneous WebGL previews
- Particle, glitch, scanline, or hard geometric effect families
