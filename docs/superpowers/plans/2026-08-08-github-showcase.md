# SPECTRA FLUX GitHub 中文展示实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建公开仓库 `damaodog/spectra-flux`，加入中文作品展示型 README 和真实页面预览图，并通过草稿 PR 发布展示改动。

**Architecture:** 远程 `master` 保存已验证的 72 种动态最终代码，`agent/github-showcase` 保存 README、预览图及设计文档。预览图直接截取本地页面，README 用相对路径引用，不增加运行时依赖。

**Tech Stack:** Git、GitHub CLI、Markdown、PNG、React、TypeScript、WebGL2/GLSL、Vinext。

## Global Constraints

- GitHub 仓库必须是公开的 `damaodog/spectra-flux`。
- GitHub 简介必须是：`72 种 WebGL 生成式动态卡片图谱，探索雾、光学、流体、晶体、电磁与引力。`
- README 以中文为主，不保留 vinext starter 模板内容。
- 预览图必须来自 `http://localhost:3000/` 的真实页面，并展示“晶体生长”页。
- 不增加第三方依赖，不修改 72 种动态的运行代码。
- 默认分支为 `master`，展示改动通过 `agent/github-showcase` 草稿 PR 提交。

---

### Task 1: 制作中文 README 与真实预览图

**Files:**
- Modify: `README.md`
- Create: `docs/images/spectra-flux-preview.png`

**Interfaces:**
- Consumes: 本地 `http://localhost:3000/` 页面和现有 `package.json` scripts。
- Produces: GitHub 首页展示文档与相对路径预览资源。

- [ ] **Step 1: 验证预览资源尚不存在**

```powershell
Test-Path docs/images/spectra-flux-preview.png
```

Expected: `False`。

- [ ] **Step 2: 截取真实页面**

使用已连接的应用内浏览器打开 `http://localhost:3000/`，切换到 `37–48 晶体生长`，将桌面视口临时设为 `1440 × 900`，等待动态渲染稳定后截图，并把 PNG 字节保存为：

```text
docs/images/spectra-flux-preview.png
```

截图完成后恢复默认视口。

- [ ] **Step 3: 写入完整中文 README**

用 `apply_patch` 将 `README.md` 替换为以下内容：

```markdown
# SPECTRA FLUX

> 72 种 WebGL 生成式动态卡片图谱，探索雾、光学、流体、晶体、电磁与引力。

![SPECTRA FLUX 页面预览](docs/images/spectra-flux-preview.png)

SPECTRA FLUX 是一个运行在浏览器中的生成式动态视觉实验。每张卡片以相同的极简白色载体呈现不同的色彩运动：烟雾交叠、光学折射、流体碰撞、晶体生长、电磁脉冲与天体引力。

项目共收录 72 种动态，每页展示 12 张卡片。点击“一键全部随机”可以同时更新全部配色与细节，也可随时暂停、播放或恢复默认状态。

## 六组动态

| 编号 | 主题 | 视觉关键词 |
| --- | --- | --- |
| 01–12 | 雾与薄纱 | 扩散、漂移、交叠、呼吸 |
| 13–24 | 光学材质 | 油膜、折射、棱镜、虹彩 |
| 25–36 | 流体力场 | 涡旋、撞击、剪切、坍缩 |
| 37–48 | 晶体生长 | 晶核、枝晶、棱面、裂隙 |
| 49–60 | 电磁脉冲 | 磁极、电弧、场线、放电 |
| 61–72 | 天体引力 | 轨道、星云、吸积、引力透镜 |

## 特点

- 72 种确定性的 WebGL 动态结构
- 一键随机全部配色与视觉细节
- 暂停、播放、重置和六页快速切换
- 卡片悬停上浮与阴影反馈
- 桌面双列、窄屏单列的响应式布局
- 明亮、半透明、柔和的 SPECTRA 视觉体系

## 性能结构

当前页面始终只渲染 12 张卡片。12 个可见的 2D canvas 共用一个 WebGL2 context 和一个 2 × 6 atlas，再将 atlas 对应区域复制到各张卡片，因此目录扩展到 72 种后仍保持稳定负载。

## 技术栈

- React 19
- TypeScript
- WebGL2 / GLSL
- Vinext / Vite
- Node.js 22+

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000/](http://localhost:3000/) 即可查看。

生产构建与测试：

```bash
npm run lint
npm test
```

## 项目状态

当前为 72 种动态最终版本。所有页面、随机与播放控制、响应式布局及 WebGL shader 均已完成自动测试和浏览器验证。
```

- [ ] **Step 4: 验证 README 和图片**

```powershell
$preview = Get-Item docs/images/spectra-flux-preview.png
if ($preview.Length -lt 50000) { throw "Preview image is unexpectedly small" }
$readme = Get-Content -Raw -Encoding UTF8 README.md
if ($readme -notmatch '72 种 WebGL' -or $readme -notmatch 'docs/images/spectra-flux-preview.png') { throw "README showcase content is incomplete" }
if ($readme -match 'vinext-starter|Workspace Auth Headers') { throw "Starter README content remains" }
```

Expected: 命令无错误退出。

- [ ] **Step 5: 提交展示资源**

```powershell
git add README.md docs/images/spectra-flux-preview.png
git commit -m "docs: add Chinese project showcase"
```

### Task 2: 验证最终项目

**Files:**
- Test: `tests/card-core.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: README 与预览图完成后的完整分支。
- Produces: 可用于 PR 的验证结果。

- [ ] **Step 1: 运行 lint**

```powershell
npx eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern .worktrees
```

Expected: exit code `0`。

- [ ] **Step 2: 运行构建和全部测试**

```powershell
npm test
```

Expected: 生产构建成功，`36` tests passed，`0` failed。

- [ ] **Step 3: 检查 Git 格式与范围**

```powershell
git diff --check master...HEAD
git status -sb
```

Expected: 无 whitespace 错误，工作区干净，分支为 `agent/github-showcase`。

### Task 3: 创建公开 GitHub 仓库并推送基线

**Files:**
- External: `https://github.com/damaodog/spectra-flux`

**Interfaces:**
- Consumes: 本地 `master` 的 72 种动态最终提交。
- Produces: 公开远程仓库和 `origin`。

- [ ] **Step 1: 再次确认登录和远程状态**

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' auth status
git remote -v
```

Expected: 登录账号为 `damaodog`，不存在现有 `origin`。

- [ ] **Step 2: 创建公开仓库**

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' repo create damaodog/spectra-flux --public --description '72 种 WebGL 生成式动态卡片图谱，探索雾、光学、流体、晶体、电磁与引力。'
git remote add origin https://github.com/damaodog/spectra-flux.git
```

Expected: GitHub 返回仓库 URL，`origin` 指向该 URL。

- [ ] **Step 3: 推送最终代码基线**

```powershell
git push -u origin master:master
& 'C:\Program Files\GitHub CLI\gh.exe' repo edit damaodog/spectra-flux --default-branch master
```

Expected: 远程 `master` 指向本地最终版本提交 `e801da7`。

### Task 4: 推送展示分支并创建草稿 PR

**Files:**
- External: GitHub branch `agent/github-showcase`
- External: Draft pull request to `master`

**Interfaces:**
- Consumes: 已验证的本地 `agent/github-showcase` 与远程 `master`。
- Produces: 可审阅、可合并的 GitHub 草稿 PR。

- [ ] **Step 1: 推送展示分支**

```powershell
git push -u origin agent/github-showcase
```

Expected: GitHub 创建远程分支并设置 tracking。

- [ ] **Step 2: 创建中文 PR 说明文件**

设置临时文件路径：

```powershell
$prBodyPath = Join-Path $env:TEMP 'spectra-flux-pr-body.md'
```

使用 `apply_patch` 在 `$prBodyPath` 写入以下 Markdown：

```markdown
## 改动

- 将 starter README 替换为 SPECTRA FLUX 中文作品介绍
- 增加本地真实页面预览图
- 说明 72 种动态、六组主题、交互方式和单 WebGL atlas 性能结构
- 补充本地运行、生产构建和测试命令

## 目的

让公开仓库首页能够直接说明项目是什么、如何运行，以及最终视觉效果。

## 用户影响

仅更新文档和预览资源，不改变任何动态效果或运行代码。

## 验证

- ESLint 通过
- 生产构建通过
- 36 项自动测试通过
- README 预览路径和 PNG 文件已检查
```

- [ ] **Step 3: 创建草稿 PR**

优先使用 GitHub 应用创建：

```text
repository_full_name: damaodog/spectra-flux
head_branch: agent/github-showcase
base_branch: master
title: docs: add Chinese project showcase
draft: true
```

如果应用无法创建，使用 GitHub CLI 和上一步的临时正文文件：

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' pr create --repo damaodog/spectra-flux --draft --base master --head agent/github-showcase --title 'docs: add Chinese project showcase' --body-file $prBodyPath
```

Expected: 返回草稿 PR URL。

- [ ] **Step 4: 验证远程结果**

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' repo view damaodog/spectra-flux --json nameWithOwner,url,visibility,defaultBranchRef,description
& 'C:\Program Files\GitHub CLI\gh.exe' pr view --repo damaodog/spectra-flux --json url,title,isDraft,baseRefName,headRefName
```

Expected: 仓库公开、默认分支为 `master`、简介准确；PR 为 draft，方向是 `agent/github-showcase` → `master`。
