# Effect library and curated homepage design

## Goal

Reshape SPECTRA FLUX into a local-first curation system with three focused pages:

- a 144-study single-effect library for exploration and deletion;
- a constrained random lab for creating one- or multi-effect recipes;
- a homepage that shows only results the user explicitly chooses.

The user curates locally in one browser. After the selection is stable, the site exports one curation configuration that can be committed as the formal public default.

## Confirmed product model

- The existing 72 studies move from the homepage into the effect library.
- The single-effect catalog doubles from 72 to 144.
- Library deletion is literal: there is no trash, archive, restore, or hidden淘汰 view.
- A deleted study also leaves the random lab's future selection pool.
- Deleting a study does not alter homepage pieces already created from it.
- A library demo can be added directly to the homepage.
- A lab result can be added directly to the homepage.
- The homepage begins empty and grows only from explicit 展示到首页 actions.
- The homepage has no total limit, but renders 12 entries per page with newest entries first.
- Homepage entries can be deleted.
- Curation persists locally; it does not update the public deployment in real time.
- The user can export the completed curation configuration for later publication.

## Information architecture

### Homepage: /

The homepage is a curated showcase only.

- It does not expose the full atomic catalog or generation controls.
- It renders saved showcase entries newest first, 12 per page.
- It links to the effect library and random lab.
- When empty, it shows a deliberate empty state with both destination links.
- Each card keeps the current 400 × 100 shape, 25/75 split, SPECTRA copy, hover lift, and external metadata.
- Each entry exposes a homepage delete action.
- Selecting an entry reveals its read-only full recipe without changing the animation.

### Effect library: /library

The library contains all available atomic studies.

- It begins with 144 single-effect studies.
- It displays 12 cards per page in the current two-column atlas layout.
- Every visible card is one study, not a mixed recipe.
- Study number and name remain outside the card.
- Every card exposes two actions outside the card: 展示到首页 and 删除.
- Deleting removes the study immediately from the library and future random selection.
- There is no per-study undo or recovery interface.
- Pagination compacts after deletion so pages do not leave artificial holes.
- Global visual randomization lets the same study be explored under different seeds and palettes.

### Random lab: /lab

The lab creates one card at a time.

- It draws from library studies that have not been deleted.
- It supports an effect count from 1 through 6.
- It exposes effect count, mix intensity, speed bounds, and palette direction.
- Study identity, direction, scale, interaction mode, per-layer seeds, and moment-to-moment speed changes remain randomized.
- It keeps the current one-card 400 × 100 preview and read-only recipe.
- It adds a primary 展示到首页 action next to randomize and pause.

## Catalog expansion

Preserve the current 01–72 names, IDs, chapters, shader variants, kernels, speeds, and parameters. Append six new chapters of 12 studies each.

### 73–84: 液态金属

Explore mercury flow, molten mirror surfaces, metal suction, reflective seams, metallic droplets, and viscous specular folds. Preserve large readable bodies and moving highlights rather than fine chrome noise.

Stable study names: 73 汞面汇流, 74 熔银卷吸, 75 金属液滴, 76 镜膜碰撞, 77 铬流剪切, 78 液金呼吸, 79 镜池坍缩, 80 合金分层, 81 金属脉冲, 82 熔镜涡旋, 83 银幕撕裂, 84 反光潮汐.

### 85–96: 生物形态

Explore cell fusion, membrane growth, mycelium spread, organic pulsing, tissue folds, colony division, and soft vascular structures. Avoid literal anatomy, photographic organisms, and disturbing imagery.

Stable study names: 85 细胞分裂, 86 膜面融合, 87 菌丝蔓延, 88 组织褶皱, 89 孢子扩散, 90 有机脉动, 91 软体卷吸, 92 群落碰撞, 93 脉络生长, 94 细胞吞噬, 95 生物膜呼吸, 96 有机潮汐.

### 97–108: 地质演化

Explore compressed strata, magma intrusion, fault slip, sediment folds, mineral flow, erosion fronts, and tectonic shear. Use broad layers and pressure boundaries rather than terrain maps.

Stable study names: 97 岩层挤压, 98 岩浆侵入, 99 断层滑移, 100 沉积褶皱, 101 矿物流脉, 102 侵蚀前沿, 103 地幔对流, 104 构造剪切, 105 熔岩冷却, 106 晶砂迁移, 107 地层坍缩, 108 板块碰撞.

### 109–120: 声学共振

Explore standing waves, node collisions, beat frequencies, harmonic membranes, pressure bands, resonance breathing, and phase cancellation. Avoid hard repeated rings and strobing stripes.

Stable study names: 109 驻波节点, 110 频率拍振, 111 谐波膜面, 112 声压碰撞, 113 共振呼吸, 114 相位抵消, 115 节点跃迁, 116 低频涌动, 117 高频丝带, 118 声场卷吸, 119 谱线交织, 120 回声扩散.

### 121–132: 拓扑曲面

Explore Möbius-like twists, surface folds, moving holes, spatial inversion, saddle flow, wrapped manifolds, and continuous inside-out transitions. Keep the result abstract and fluid rather than diagrammatic.

Stable study names: 121 莫比乌斯扭转, 122 曲面折叠, 123 拓扑孔洞, 124 空间翻转, 125 鞍面涌流, 126 流形卷吸, 127 内外反转, 128 环面碰撞, 129 曲率脉冲, 130 连续形变, 131 纽结解构, 132 边界重连.

### 133–144: 相变幻景

Explore condensation, vaporization, frosting, melting, sublimation, nucleation fronts, liquid-to-gel transitions, and eased state changes. Motion stays continuous without flashing or resetting.

Stable study names: 133 凝结前沿, 134 汽化涌升, 135 结霜蔓延, 136 熔解塌缩, 137 升华漂移, 138 晶核相变, 139 液凝转化, 140 凝胶呼吸, 141 沸点爆发, 142 冻融撕裂, 143 相界碰撞, 144 状态跃迁.

All new studies continue to use one shared single-effect shader and atlas architecture. New kernels may be added, but approved 01–72 identities do not change.

## Unified showcase recipe

Single-effect and lab-generated homepage entries use the same data format.

    type ShowcaseEntry = {
      id: string;
      createdAt: number;
      source: "library" | "lab";
      recipe: LabRecipe;
    };

    type CurationState = {
      version: 1;
      deletedStudyIds: number[];
      showcase: ShowcaseEntry[];
    };

A library demo becomes a one-layer LabRecipe snapshot. A lab result already has a LabRecipe.

The snapshot includes study identity and parameters, current colors, seed, intensity, speed profile, transform, weight, interactions, source type, and creation timestamp.

The homepage never re-randomizes saved entries. A saved entry remains visually stable across reloads apart from continuous animation.

## Add-to-home behavior

### From the library

展示到首页 captures the card exactly as currently configured. It must not generate another palette or seed during the add action.

The same atomic study may be added multiple times after global library randomization produces a different visible configuration. Re-adding the exact current configuration is ignored and reports 已在首页.

### From the lab

展示到首页 captures the current complete recipe. Re-adding the unchanged current recipe is ignored and reports 已在首页. Randomizing creates a new recipe that may be added.

### After addition

- The new entry appears first on the homepage.
- The action confirms success without navigating away.
- Removing a source study later does not remove or mutate the saved entry.
- Deleting a homepage entry affects only the showcase, not the library.

## Random constraints

### Effect count

Clamp to 1–6 and to the active library size. Study IDs remain unique inside a multi-effect recipe.

### Mix intensity

- 柔和 lowers collision contrast, warp strength, and per-layer dominance.
- 均衡 uses the current approved interaction ranges.
- 激烈 increases collision seams, engulf displacement, and difference cuts while retaining luminance compression.

Intensity changes interaction coefficients, not animation speed.

### Speed bounds

The user selects one minimum and maximum range. The generator assigns every layer a distinct subrange inside those constraints.

Every active layer keeps a positive, continuously integrated phase clock. Smooth value noise and bounded surge envelopes create irregular acceleration and slowdown. No layer reverses, jumps phase, or multiplies absolute time by a changing speed.

### Palette direction

The selected strategy constrains the existing coordinated-palette generator. 随机 selects one of the five named strategies. Palette generation continues to enforce hue and luminance separation.

## Library deletion semantics

Deletion writes the study ID into deletedStudyIds.

- Library views filter it out immediately.
- Lab selection filters it out immediately.
- Existing showcase snapshots remain valid.
- No product UI restores deleted IDs.
- Exported curation preserves deleted IDs.
- Invalid or out-of-range IDs are ignored when loading.

If every study is deleted, the library shows an empty state and the lab disables randomization with a clear explanation.

## Local persistence

Use one versioned browser-storage key named spectra-curation-v1.

All changes pass through a pure curation-state module that validates and normalizes before writing.

Loading rules:

- absent key means empty deletion list and empty homepage;
- valid version 1 normalizes IDs, removes duplicate showcase IDs, and preserves order;
- malformed JSON or invalid shape keeps the last valid in-memory state and shows a non-blocking warning;
- unavailable storage continues for the current session and shows 仅本次会话保存.

The application must not silently overwrite malformed stored data. Same-document changes use one custom curation event; cross-tab changes use the browser storage event.

## Export for final publication

The homepage exposes a secondary 导出策展配置 action.

- It downloads one UTF-8 JSON file containing normalized CurationState.
- It contains no account, browser, history, or unrelated device data.
- Import is not part of this iteration.
- Once approved, the exported JSON can become the repository's default curation configuration and be deployed to the public Worker.

## Rendering architecture

### Library

Keep one WebGL atlas for the 12 visible atomic studies. Deletion and pagination update the cell configuration without creating more contexts.

### Homepage

Use one multi-recipe WebGL atlas for at most 12 visible showcase entries. Each cell receives its recipe's active layer count and six fixed uniform slots.

The renderer:

- supports one- and multi-layer entries;
- uses one WebGL2 context and one source canvas;
- draws each visible atlas cell once per frame;
- copies cells into 12 visible 2D canvases;
- keeps independent phase-clock arrays per visible recipe;
- uploads static uniforms only when page entries change;
- caps device pixel ratio as the current gallery does.

### Lab

Keep the existing one-card, one-context, one-draw renderer.

## Responsive and accessibility behavior

- Preserve the desktop left rail and two-column card area.
- Collapse to one card column at the existing breakpoint.
- Keep every card at 4:1 and at most 400px wide.
- Keep action buttons outside cards and at least 44px on touch layouts.
- Use explicit labels for delete and add actions, including the exact target name.
- Announce additions through aria-live.
- Delete actions require no confirmation because they affect local curation only.
- Under reduced motion, render one stable frame and do not auto-advance.

## Failure handling

- WebGL failure falls back to the saved palette gradient and keeps management actions working.
- Storage failure never blocks browsing, random generation, addition, or deletion for the session.
- A recipe referencing an unknown study renders from its saved shader identity when valid; otherwise it uses the palette fallback.
- Invalid recipe bounds normalize before rendering.
- Export failure shows a concise error and leaves state untouched.

## Testing

### Catalog tests

- Catalog contains exactly 144 stable, unique, consecutive IDs.
- Existing 01–72 identities remain unchanged.
- New chapters contain exactly 12 studies each and valid bounded kernels.
- Pagination returns 12 studies per full page before deletion.

### Curation-state tests

- Default state is empty and versioned.
- Deletion filters library and lab pool.
- Deleted sources do not remove showcase entries.
- One-layer and multi-layer snapshots share one schema.
- Exact duplicate additions are rejected.
- New configurations of the same study can be added.
- Homepage deletion affects only showcase.
- Malformed storage does not overwrite the last valid state.
- Export contains only normalized curation state.

### Random-lab tests

- Effect count clamps to 1–6 and active pool size.
- Deleted IDs never appear.
- Mix-intensity profiles change only interaction coefficients.
- Speed subranges remain inside user bounds and maintain min below max.
- Palette strategies obey the requested direction.
- Fixed seeds and settings reproduce identical recipes.

### Rendered-page and browser checks

- The homepage starts with a curated empty state and later renders 12 entries per page.
- The library exposes 144 studies before deletion and both actions per card.
- The lab exposes all four constraint groups and 展示到首页.
- Navigation connects all three pages.
- Library and homepage each contain one shared atlas context.
- Delete a study and confirm it disappears from library and future lab recipes.
- Add the current single-effect configuration and confirm it appears first at home.
- Add 1-, 3-, and 6-layer lab recipes.
- Reload routes and confirm persistence.
- Delete a homepage entry and confirm the library remains unchanged.
- Export JSON and verify it contains only version, deleted IDs, and showcase recipes.
- Verify 12 visible cards remain responsive with no console errors.

## Out of scope

- Cloud database, administrator login, or real-time public synchronization.
- Trash, restore, archive, or undo for library deletion.
- Importing curation JSON.
- Drag-and-drop homepage reordering.
- Editing a saved homepage recipe in place.
- Image, video, embed, or shader-code export.
- More than 144 atomic studies in this iteration.
