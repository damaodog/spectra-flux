# Curated Motion Atlas V2 Design

## Goal

Re-curate the existing thirty-six-card local WebGL gallery around the user's nine selected studies. Each chapter keeps its selected studies first, renumbers them by their new display order, and replaces every rejected study with a newly designed motion identity.

The gallery remains local at `http://localhost:3000/`, contains three pages of twelve cards, and renders only the active page through one shared WebGL2 atlas.

## Selected Studies and New Numbers

The selected studies retain their current shader behavior, semantic speed, and visual structure. Palette, seed, and fine detail may still change through the existing random action.

| Chapter | Old number | New number | Name |
| --- | ---: | ---: | --- |
| Mist and Veil | 01 | 01 | 柔雾扩散 |
| Mist and Veil | 03 | 02 | 横向薄纱 |
| Mist and Veil | 05 | 03 | 斜向漂移 |
| Mist and Veil | 11 | 04 | 急速奔流 |
| Optical Material | 13 | 13 | 油膜涌色 |
| Optical Material | 22 | 14 | 柔焦色蚀 |
| Fluid Force | 30 | 25 | 液面干涉 |
| Fluid Force | 32 | 26 | 相位潮汐 |
| Fluid Force | 34 | 27 | 细胞融汇 |

Display numbering and shader identity become separate fields. Reordering a selected study therefore cannot silently change which legacy shader branch it uses.

## Collection

### Page 1 — Mist and Veil

The eight new studies extend the layered horizontal language of the selected old study 03, but each receives a distinct boundary event or flow rhythm.

| No. | Name | Motion identity |
| ---: | --- | --- |
| 01 | 柔雾扩散 | Preserve old 01: broad translucent diffusion. |
| 02 | 横向薄纱 | Preserve old 03: layered horizontal weave. |
| 03 | 斜向漂移 | Preserve old 05: diagonal drifting field. |
| 04 | 急速奔流 | Preserve old 11: rapid horizontal rush. |
| 05 | 双向潮缝 | Opposing veils compress into a traveling soft seam, then pass through one another. |
| 06 | 织带交叠 | Three translucent bands cross at unequal speeds and form temporary braided overlaps. |
| 07 | 剪切尾流 | A fast central sheet pulls two slower edge layers into a long wake. |
| 08 | 云脊翻涌 | A broad cloud ridge rises, curls over, and dissolves into the next ridge. |
| 09 | 绸带塌缩 | A wide satin-like ribbon narrows into a dense line and opens again without resetting. |
| 10 | 丝线回声 | Thin parallel filaments follow one another with delayed amplitude and soft reconnection. |
| 11 | 逆层卷吸 | The foreground advances while a lower translucent layer is pulled backward along the boundary. |
| 12 | 雾幕呼吸 | Two wide curtains inhale and exhale around a continuously drifting center seam. |

### Page 2 — Optical Material

The new studies must read as translucent or refractive material. They use visible internal ridges, rims, or phase boundaries so they do not collapse into flat gradients.

| No. | Name | Motion identity |
| ---: | --- | --- |
| 13 | 油膜涌色 | Preserve old 13: drifting thin-film color domains. |
| 14 | 柔焦色蚀 | Preserve old 22: irregular color erosion and diffused return. |
| 15 | 焦散折叠 | Two narrow caustic ridges fold over a milky translucent base. |
| 16 | 玻璃对撞 | Soft lens bodies approach, flatten at contact, and refract through one another. |
| 17 | 棱镜绽放 | A moving refraction ridge opens into separated hues and closes again. |
| 18 | 珠光脉冲 | Pearlescent highlights pulse across a viscous body with a slower trailing halo. |
| 19 | 蛋白石裂隙 | Opalescent domains separate along a luminous irregular fissure and slowly heal. |
| 20 | 虹彩虹吸 | A narrow luminous channel pulls surrounding spectral haze toward its path. |
| 21 | 折射泡沫 | Rounded transparent cells collide, share bright rims, and exchange volume. |
| 22 | 发光膜面 | A thin membrane bends through the card with a bright crest and dim underside. |
| 23 | 柔波干涉 | Two refracted wave systems create broad drifting interference cells. |
| 24 | 虹彩脉络 | Branching luminous veins grow through soft color material and merge downstream. |

### Page 3 — Fluid Force

The new studies emphasize momentum, pressure, collision, roll-up, and density change. Every effect needs a visible force boundary instead of only a color shift.

| No. | Name | Motion identity |
| ---: | --- | --- |
| 25 | 液面干涉 | Preserve old 30: crossing waves form drifting transient cells. |
| 26 | 相位潮汐 | Preserve old 32: slow wavefronts phase across the width. |
| 27 | 细胞融汇 | Preserve old 34: soft cells merge and separate along shared boundaries. |
| 28 | 涡旋合并 | Two rotating fluid masses approach and combine into one displaced vortex. |
| 29 | 射流撞击 | Opposing narrow jets strike a central front and fan into lateral plumes. |
| 30 | 冲击环 | A compressed core releases an expanding, irregular pressure halo through fog. |
| 31 | 逆流撕裂 | A main current advances while a thin countercurrent opens a traveling tear. |
| 32 | 黏性坍缩 | A broad dense body contracts into a weighted core and then stretches sideways. |
| 33 | 边界卷起 | A shear boundary rolls into repeated soft curls that detach downstream. |
| 34 | 密度呼吸 | Low-frequency masses alternately absorb and release color through a narrow channel. |
| 35 | 潮汐剪切 | Upper and lower tides move at different rates, compressing their shared interface. |
| 36 | 湍流编织 | Several fast filaments braid around a slower central flow and repeatedly reconnect. |

## Rendering Design

- Keep the current one-context, `2 × 6` hidden WebGL atlas and twelve visible 2D canvases.
- Keep the active-page-only render loop and the current device-pixel-ratio ceiling.
- Keep the existing selected shader branches intact.
- Add only the minimum shared field helpers needed by the twenty-seven replacements. New studies combine reusable seam, ribbon, lens, cell, ring, jet, and filament fields through per-study parameters.
- Do not create one shader program per card or one full shader per study.
- Give each catalog item a display position and a shader variant independently. Labels, accessible names, and page ranges use display position; shader dispatch uses shader variant.

## Interaction and Layout

- Preserve `400 × 100` cards, the `25% / 75%` text-to-visual split, two desktop columns, one narrow-screen column, and labels outside cards.
- Preserve one-click randomization, pause/play, reset, page navigation, whole-card lift, and shadow.
- Randomization changes palettes, seeds, and fine parameters for all thirty-six studies without changing order or motion identity.
- Reset restores this V2 order and returns to page 1.

## Acceptance Criteria

- The three pages contain exactly twelve studies each and only twelve canvases are mounted.
- Selected old studies map exactly to new numbers `01–04`, `13–14`, and `25–27` as listed above.
- The selected studies retain their old shader kernel, legacy variant where applicable, and semantic speed.
- All twenty-seven replacements have new names and motion identities; none retain the rejected catalog identity merely under a new number.
- Page 1 visibly contains layered veils, seams, wakes, folds, and breathing bands.
- Page 2 visibly contains refractive ridges, luminous rims, membranes, cells, and veins.
- Page 3 visibly contains collision fronts, pressure rings, tears, roll-up, collapse, and braid motion.
- No new study remains a nearly uniform two-color fill for its full cycle.
- Playback, pause stability, randomization, reset, hover feedback, and all three page controls continue to work without a WebGL or resize error overlay.

## Testing

- Catalog tests assert the exact thirty-six-name order and every selected old-to-new mapping.
- Shader tests assert the new shared structural fields and the selected legacy signatures.
- Rendered-source tests retain the one-context, twelve-canvas, pagination, responsive-layout, and hover checks.
- Browser verification captures all three pages and checks active-page labels, canvas count, motion while playing, pixel stability while paused, randomization, reset, and absence of the development error overlay.

## Non-Goals

- Export, recording, or public hosting
- Per-card editing controls
- Particles, glitch, scanlines, or hard geometric effects
- More than twelve simultaneously animated cards
- Independent WebGL contexts or shader programs per card
