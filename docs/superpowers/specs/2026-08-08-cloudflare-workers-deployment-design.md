# SPECTRA FLUX Cloudflare Workers 发布设计

## 目标

将当前 `master` 中已经验证的 SPECTRA FLUX 发布到 Cloudflare Workers，并使用 `https://spectra.8538690.xyz` 作为正式预览地址。发布后同步更新 GitHub 仓库 About 的 Website 字段与中文 README，让访问者能从仓库首页直接进入在线版本。

## 平台选择

采用 Cloudflare Workers，不使用 Vercel 或 Cloudflare Pages。

- 当前项目已经通过 `@cloudflare/vite-plugin` 生成 Workers 可直接部署的服务端入口、静态资源目录与 Wrangler 配置。
- Vercel 需要额外适配 Vinext 构建产物。
- Pages 需要把现有 Worker 改造成高级模式的 `_worker.js` 目录，增加了不必要的打包步骤。

## 域名与部署标识

- Worker 名称：`spectra-flux`
- 正式地址：`https://spectra.8538690.xyz`
- 备用地址：Cloudflare 为 `spectra-flux` 自动提供的 `workers.dev` 地址
- Cloudflare 自定义域名负责自动创建所需 DNS 记录并签发证书。

如果 `spectra.8538690.xyz` 已存在冲突的 DNS 记录，停止发布并报告冲突，不覆盖现有记录。

## 发布方式

1. 在干净工作树中运行现有生产构建。
2. 使用构建生成的 `dist/server/wrangler.json` 部署，不修改卡片运行代码。
3. 部署时显式指定 Worker 名称和自定义域名。
4. 保留 `workers.dev` 地址，作为域名证书尚未完成时的备用入口。

不新增部署框架、运行时依赖或持久化资源。

## GitHub 展示更新

README 在开头增加“在线预览”链接，目标为 `https://spectra.8538690.xyz`。GitHub 仓库 About 的 Website 字段设置为同一地址。项目描述、预览图和其余正文保持不变。

README 更新通过独立提交推送并合并到 `master`；GitHub About 通过 GitHub API 更新。

## 验证

发布前：

- ESLint 通过。
- 生产构建通过。
- 36 项自动测试通过。
- DNS 查询确认目标子域名没有现有冲突记录。

发布后：

- 正式地址返回成功响应。
- 页面标题与 SPECTRA FLUX 内容正确。
- 浏览器中能看到动态卡片，分页与随机按钮可用。
- GitHub About 和 README 均指向正式地址。
- 本地 `master` 与远端 `master` 最终一致且工作树干净。

## 回退

如果正式域名失败但 Worker 部署成功，先保留 `workers.dev` 备用地址，不修改 GitHub About。修复域名后再完成 GitHub 展示更新。

如果 Worker 部署本身失败，不提交 README 地址，也不更改 GitHub About。
