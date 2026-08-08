# SPECTRA FLUX GitHub 中文展示设计

## 目标

将本地最终版 SPECTRA FLUX 发布到公开 GitHub 仓库 `damaodog/spectra-flux`，并以作品展示型中文 README 清楚呈现项目定位、视觉效果、功能结构、性能方案和本地运行方法。

## 仓库设置

- 仓库名称：`spectra-flux`
- 所有者：`damaodog`
- 可见性：公开
- GitHub 简介：`72 种 WebGL 生成式动态卡片图谱，探索雾、光学、流体、晶体、电磁与引力。`
- 默认分支：`master`
- 发布方式：保留 `master` 作为最终代码基线，在 `agent/github-showcase` 提交中文 README 与预览资源并创建草稿 PR。

## README 结构

1. `SPECTRA FLUX` 标题和一句中文定位
2. 一张桌面端实机预览图
3. 项目介绍：72 种动态、六组主题、每页 12 张卡片
4. 六组主题表格：编号范围、主题名称、视觉关键词
5. 核心特点：动态随机、暂停/播放、重置、悬停反馈、响应式布局
6. 性能说明：当前页 12 个 2D canvas 共用一个 WebGL2 atlas/context
7. 技术栈：React、TypeScript、WebGL2/GLSL、Vinext
8. 本地运行：安装依赖、启动开发服务器、生产构建和测试命令
9. 项目状态：最终版共 72 种动态，自动测试通过

README 以中文为主，保留必要的英文技术名词。语言简洁，不加入徽章墙、路线图、赞助、许可证推测或未实现功能。

## 预览图

- 文件：`docs/images/spectra-flux-preview.png`
- 来源：本地 `http://localhost:3000/` 的真实页面截图
- 画面：桌面宽屏布局，左侧完整显示品牌、简介、操作区和六个分页；右侧展示新增的“晶体生长”卡片
- 预览图不进行额外合成，不覆盖文字水印，确保与实际项目一致
- README 使用相对路径引用，GitHub 页面可直接显示

## 发布流程

1. 创建公开 GitHub 仓库并连接为 `origin`
2. 推送现有 `master`，建立远程默认基线
3. 在 `agent/github-showcase` 完成 README 和预览图
4. 运行 lint、构建与测试
5. 推送展示分支并创建面向 `master` 的草稿 PR
6. PR 中文说明包含改动、目的、用户影响和验证结果

## 验收标准

- GitHub 仓库为公开并可访问
- 仓库简介准确显示 72 种动态定位
- README 全中文、结构清晰且无 starter 模板遗留内容
- README 中预览图片可正常显示
- 本地运行命令与 `package.json` 一致
- `npm run lint`、`npm test` 与 `git diff --check` 通过
- 展示分支已推送，并存在面向 `master` 的草稿 PR
