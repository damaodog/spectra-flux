# SPECTRA FLUX 七十二种动态实现计划

> **执行要求：** 按 TDD 顺序逐批完成；每批先看到目标测试失败，再实现并验证。不要改变现有 01–36 的名称、编号和参数映射。

**目标：** 将动态目录扩展为六组、七十二种，新增晶体生长、电磁脉冲和天体引力三组视觉，同时维持当前页十二张卡片共享一个 WebGL atlas 的性能结构。

**架构：** `motion-catalog.ts` 负责 72 项确定性目录，`page.tsx` 只切出当前页 12 项，`card-core.ts` 在同一个片元着色器中通过 kernel 27–44 分发新增结构场。新增视觉不引入依赖、不增加 WebGL context、不做多步流体求解。

**技术栈：** TypeScript、React、WebGL2/GLSL、Node test runner、ESLint、Vinext。

---

## 任务一：扩展目录、分页与界面文案

**文件：**
- 修改：`tests/card-core.test.mjs`
- 修改：`tests/rendered-html.test.mjs`
- 修改：`app/motion-catalog.ts`
- 修改：`app/page.tsx`
- 修改：`app/layout.tsx`

1. 在测试中把总数改为 72、分页改为 6×12，并新增 37–72 精确名称、连续 ID、章节 0–5、kernel 27–44 的断言；保留对旧 01–36 精确名称和关键映射的断言。
2. 为源码文案增加 `SEVENTY-TWO`、`七十二`、六个分页标签及随机/重置提示的断言。
3. 运行 `node --test tests/card-core.test.mjs tests/rendered-html.test.mjs`，确认目录与页面测试因仍是 36 项而失败。
4. 扩展 `MotionStudy.chapter` 为 `0 | 1 | 2 | 3 | 4 | 5`，新增 36 条目录记录并将 `getMotionPage` 上限改为 6。
5. 页面加入 `37–48｜晶体生长`、`49–60｜电磁脉冲`、`61–72｜天体引力`，把所有 36/三十六/三页文案更新为 72/七十二/六页；保留每页 12 项切片和 2×6 atlas。
6. 运行两份测试，确认目录和文案测试通过；提交 `feat: expand spectra flux to seventy-two studies`。

## 任务二：实现晶体生长 37–48

**文件：**
- 修改：`tests/card-core.test.mjs`
- 修改：`app/card-core.ts`

1. 增加测试，要求 shader 包含并分发 kernel 27–32：`crystalNucleationField`、`dendriteField`、`mineralVeinField`、`facetFoldField`、`crystalCollisionField`、`fractureGlowField`，并限制旧 force finishing 只覆盖 22–26。
2. 运行 `node --test tests/card-core.test.mjs`，确认新增 shader 测试失败。
3. 用折线距离、角度量化、Voronoi/噪声边缘和时变阈值实现六个四通道结构场；每个场提供生长、折面、碰撞或裂隙事件，避免仅改变颜色。
4. 分发 kernel 27–32，并增加晶体 finishing：硬边、棱面高光、裂隙亮线与轻微虹彩。
5. 运行核心测试并提交 `feat: add crystal growth motion fields`。

## 任务三：实现电磁脉冲 49–60

**文件：**
- 修改：`tests/card-core.test.mjs`
- 修改：`app/card-core.ts`

1. 增加测试，要求 shader 包含并分发 kernel 33–38：`dipoleCollisionField`、`arcJumpField`、`fieldLineField`、`pulseBurstField`、`plasmaJetField`、`chargeDiffuseField`。
2. 运行核心测试，确认新增 shader 测试失败。
3. 用双极势场、分叉线、扭转场线、扩张环、喷流束和排斥团实现六个结构场；通过高低速参数形成撞击、爆发、闪移、呼吸与织网节奏。
4. 分发 kernel 33–38，并增加电磁 finishing：高亮细线、能量核心、冲击边缘和局部色散。
5. 运行核心测试并提交 `feat: add electromagnetic pulse motion fields`。

## 任务四：实现天体引力 61–72

**文件：**
- 修改：`tests/card-core.test.mjs`
- 修改：`app/card-core.ts`

1. 增加测试，要求 shader 包含并分发 kernel 39–44：`orbitField`、`gravityWellField`、`coronaField`、`nebulaMergeField`、`accretionField`、`cosmicWebField`，并要求 `buildEmbed` 支持最大 kernel 44。
2. 运行核心测试，确认新增 shader/嵌入测试失败。
3. 用双核心轨道、径向空间扭曲、日冕喷发、双云团融合、吸积旋臂和长距离节点连线实现六个结构场。
4. 分发 kernel 39–44，增加天体 finishing，并把嵌入参数上限从 26 提高至 44。
5. 运行核心测试并提交 `feat: add cosmic gravity motion fields`。

## 任务五：整体验证与浏览器视觉检查

**文件：**
- 可能修改：`app/card-core.ts`
- 可能修改：`app/globals.css`
- 可能修改：`app/page.tsx`

1. 运行 `npm run lint`、`npm test` 和 `git diff --check`，修复任何失败。
2. 打开 `http://localhost:3000/`，逐页检查第 4、5、6 页各有 12 张卡片，首尾标签分别为 37/48、49/60、61/72。
3. 视觉检查三组有明确结构差异且仍符合明亮半透明 SPECTRA 风格；如出现纯色、闪烁、重复感或 shader 编译错误，只调整对应结构场和 finishing。
4. 检查随机、暂停/播放、重置、六页切换；确认随机提示为七十二款，重置回第一页。
5. 在桌面及窄屏检查六个分页按钮可访问、无横向溢出、左栏可滚动；确认控制台无错误且当前页仍只有 12 个 canvas 和一个 WebGL2 context。
6. 再运行 `npm run lint && npm test` 与 `git status --short`，提交最终修正 `fix: polish seventy-two study atlas`（仅在有修正时）。
