# SPECTRA FLUX 管理策展、高级随机与 HTML 调用设计

日期：2026-08-09

## 1. 目标

在现有 144 种 WebGL 动态、单卡随机实验室和本地策展首页上增加三个能力：

1. 真实的服务端管理登录，只有管理员可以增删公共策展内容。
2. 所有访客共享同一套策展首页，而不是每台浏览器各自保存。
3. 随机实验室增加五组可选约束，并允许从首页或实验室复制单卡 HTML 调用代码。

现有视觉风格、400 × 100 卡片、12 卡分页、单 WebGL atlas 性能结构保持不变。

## 2. 已确认的产品决定

- 管理密码由 Cloudflare Worker Secret 保存，初始值由部署时设置为 `wlh1124`，不写入前端代码或仓库。
- 登录状态仅维持当前浏览器会话；关闭浏览器后自动失效。
- 公共首页、删除记录和策展作品保存在 Cloudflare KV，所有访客看到同一套内容。
- 未登录访客可以浏览、随机和复制 HTML，但不能增删公共数据。
- 选择 Cloudflare KV，而不是 D1 或 Durable Object。当前数据只有一份小型 JSON，KV 是足够且最短的实现。
- 新增随机约束为混合方式、节奏类型、空间构图、层次密度、边缘质感。
- HTML 导出范围为单张卡片，不导出整个策展首页。
- HTML 调用依赖 `spectra.8538690.xyz`，本阶段不制作离线独立 HTML。

## 3. 总体架构

```text
访客浏览器
  ├─ GET /api/curation ────────────────┐
  ├─ POST /api/admin/login             │
  ├─ 管理写请求 + HttpOnly Cookie       │
  └─ /embed?recipe=<紧凑配方>           │
                                       ▼
Cloudflare Worker
  ├─ 登录、会话签名、Origin 校验、限速
  ├─ 公共读取与受保护写入 API
  ├─ 配方验证与状态规范化
  └─ Vinext 页面处理器
                                       │
                                       ▼
Cloudflare KV
  ├─ curation:v2
  └─ auth:attempt:<IP 哈希>
```

Worker 在进入 Vinext 页面处理器前拦截 `/api/*` 请求。页面仍由现有 Vinext 应用渲染，不引入新的服务端框架。

## 4. 管理认证

### 4.1 界面

- 首页顶部增加“管理”按钮。
- 点击后打开小型对话框，包含密码输入、登录和取消。
- 登录成功后按钮变为“管理中”，同时提供“退出管理”。
- 错误密码、暂时锁定和网络失败使用明确的中文状态，不清空当前页面。
- 登录对话框支持键盘焦点、回车提交、Escape 关闭和可读的错误提示。

### 4.2 会话

- `SPECTRA_ADMIN_PASSWORD`：管理员密码 Secret。
- `SPECTRA_SESSION_SECRET`：至少 32 字节随机签名 Secret。
- 登录成功后 Worker 生成带签发时间和随机 nonce 的会话载荷，并用 HMAC-SHA-256 签名。
- Cookie 使用 `HttpOnly; Secure; SameSite=Strict; Path=/`。
- Cookie 不设置 `Max-Age` 或 `Expires`，因此属于浏览器会话 Cookie。
- 服务端同时限制会话最长 12 小时，即使浏览器没有及时销毁 Cookie 也会失效。
- 退出管理只清除 Cookie；轮换会话 Secret 可立即让全部旧会话失效。

### 4.3 请求保护

- 所有写请求必须通过签名与时间校验。
- 所有写请求同时校验 `Origin` 与当前请求源一致，降低 CSRF 风险。
- 密码比较使用固定长度摘要与恒定时间字节比较。
- 登录失败按 `CF-Connecting-IP` 的 HMAC 哈希记录，避免保存原始 IP。
- 15 分钟内连续失败 5 次后暂时拒绝新登录；成功登录清除失败记录。
- API 不在响应或日志中返回密码、签名 Secret 或完整 Cookie。

## 5. 公共策展数据

### 5.1 KV 结构

- Binding：`CURATION_KV`。
- 主键：`curation:v2`。
- 值：经过现有规范化器验证的 `CurationStateV2` JSON。
- KV 缺失时返回安全的空策展状态。
- KV 内容无法解析时返回空状态与服务端错误标记，不自动覆盖损坏的原值。

站点只有一个管理员，写入频率很低，因此不增加锁服务。管理员写请求会返回刚写入的规范化状态，当前页面立即更新；不同地区访客可能因 KV 传播晚几十秒看到更新，这是已接受的取舍。

### 5.2 API

| 方法 | 路径 | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/curation` | 公共 | 读取共享策展状态 |
| GET | `/api/admin/session` | 公共 | 返回当前会话是否有效 |
| POST | `/api/admin/login` | 公共、限速 | 验证密码并设置 Cookie |
| POST | `/api/admin/logout` | 已登录 | 清除 Cookie |
| POST | `/api/showcase` | 已登录 | 添加精确单效或混合配方 |
| DELETE | `/api/showcase/:id` | 已登录 | 从首页删除作品 |
| DELETE | `/api/studies/:id` | 已登录 | 从效果库删除原子效果 |
| POST | `/api/curation/import-local` | 已登录 | 一次性合并本机旧策展数据 |

所有请求和响应都复用同一套状态、配方与编号验证。未授权写请求返回 `401`，Origin 不正确返回 `403`，输入无效返回 `400`，登录限速返回 `429`。

### 5.3 前端数据流

- `useCuration` 从直接操作 `localStorage` 改为读取公共 API、调用受保护写 API。
- 首页加载时并行读取策展状态和管理会话。
- 写操作不做可能造成误导的永久乐观更新，以服务器返回的规范化状态替换页面状态。
- 网络失败时保留当前展示并允许重试。
- 原 `spectra-flux-curation-v1` 只作为一次性迁移来源保留，不再作为公共状态来源。
- 管理员登录后，如检测到有效旧状态，显示“同步本机策展”按钮；只有主动点击才提交合并。
- 合并按现有精确配方指纹去重，服务器已有项目优先保留。

## 6. 管理模式下的操作可见性

| 页面 | 访客 | 管理模式 |
| --- | --- | --- |
| 首页 | 浏览、查看配方、复制 HTML | 再显示“从首页删除” |
| 效果库 | 浏览、随机、暂停、分页 | 再显示“展示到首页”“删除效果” |
| 随机实验室 | 调整参数、随机、暂停、复制 HTML | 再显示“展示到首页” |

公共复制 HTML 不改变服务器数据，因此不要求登录。

## 7. 高级随机约束

### 7.1 设置类型

现有 `LabSettings` 增加五个字段。每一项在设置阶段允许 `random`，生成后的 `LabRecipe` 保存解析后的具体值，从而保证导出与再次渲染完全一致。

```ts
type InteractionBias =
  | "random" | "free" | "blend" | "collision" | "weave"
  | "erode" | "light" | "difference";

type RhythmDirection =
  | "random" | "wander" | "breath" | "alternating" | "pulse" | "flow";

type CompositionDirection =
  | "random" | "automatic" | "horizontal" | "center-collision"
  | "pincer" | "vortex" | "interlace";

type DensityDirection = "random" | "thin" | "standard" | "dense";
type EdgeDirection = "random" | "soft" | "mixed" | "sharp";
```

### 7.2 混合方式

- 自由混合：六种现有交互等概率组合。
- 融合为主：提高 `融合` 权重。
- 碰撞为主：提高 `碰撞` 权重。
- 交缠为主：提高 `交缠` 权重。
- 侵蚀吞噬：提高 `吞噬` 权重。
- 光学叠加：提高 `光叠` 权重。
- 差异切割：提高 `差异切割` 权重。

“为主”允许少量其他方式穿插，避免六层效果全部使用同一种算法而显得机械。

### 7.3 节奏类型

- 自由变速：保持现有连续随机游移与少量加速。
- 缓慢呼吸：低频、平滑、较窄速度跨度。
- 快慢交替：更明显但连续的上下限往返。
- 脉冲爆发：大部分时间缓慢，偶尔接近上限。
- 持续奔流：速度保持在区间中高段，小幅随机摆动。

`SpeedProfile` 增加 `surgeMix`。旧配方缺失时使用当前等效值 `0.18`，速度继续保证不倒退、不越过用户上下限。

### 7.4 空间构图

- 自动构图：保留现有随机缩放和角度。
- 横向流入：层从左右不同位置穿过。
- 中央碰撞：主要质量朝中心交汇。
- 双向夹击：两组层从左右相向运动。
- 涡旋汇聚：层围绕中心分布并带旋转偏置。
- 层叠穿插：错位、错角、不同缩放交叉。

`LabLayer` 增加二维 offset，打包器增加 `layerOffsets[6]` uniform。偏移只影响实验室混合，不改变原子效果库。

### 7.5 层次密度与边缘质感

- 稀薄、标准、浓密控制图层强度、权重和 shader 中的 density multiplier。
- 柔雾、柔锐混合、清晰切面控制 layer mask 的 smoothstep 宽度。
- shader 增加配方级 `densityScale` 和 `edgeSharpness` uniform，不复制新的渲染分支。
- 旧配方默认 `standard + mixed`，视觉保持接近当前版本。

### 7.6 控件布局

- 原有效果数量、混合强度、速度上下限、配色方向保持可见。
- 新五组放入原生 `<details>`“更多随机约束”，默认折叠。
- 使用原生 select 和按钮，不增加 UI 依赖。
- 配方摘要展示已解析的混合方式、节奏、构图、密度和边缘结果。

## 8. 单卡 HTML 调用代码

### 8.1 操作位置

- 首页每张卡片显示“复制 HTML”。
- 随机实验室当前卡片旁显示“复制 HTML”。
- 复制成功或失败通过现有状态区域反馈，不使用阻塞式 alert。

### 8.2 调用格式

```html
<iframe
  src="https://spectra.8538690.xyz/embed?recipe=<base64url>"
  title="SPECTRA dynamic card"
  width="400"
  height="100"
  loading="lazy"
  referrerpolicy="no-referrer"
  style="border:0;border-radius:54px;overflow:hidden">
</iframe>
```

使用者可以把 `width` 改为 `100%`，并在容器上维持 `aspect-ratio: 4 / 1`。

### 8.3 配方编码

- 新增纯函数 `encodeEmbedRecipe`、`decodeEmbedRecipe` 和 `buildEmbedSnippet`。
- 只编码渲染必需字段，不编码 UI 文案、创建时间或策展 ID。
- 使用 `TextEncoder`、URL-safe Base64 和版本号，不增加压缩依赖。
- 解码后必须通过与 API 相同的配方规范化器。
- URL 配方设置 8 KB 上限；超过时拒绝生成，并提示减少图层数量。
- 配方直接包含在 URL 中，因此首页删除不会让已复制的调用失效。

### 8.4 `/embed` 页面

- 只包含一张 400 × 100 卡片和一个 WebGL context。
- 不显示导航、管理、配方详情或导出按钮。
- `IntersectionObserver` 检测不可见状态并暂停动画。
- 尊重 `prefers-reduced-motion`。
- 无效或超限配方显示轻量错误卡，不执行 shader。
- 本地开发生成当前 origin 的调用地址，生产环境固定使用 `https://spectra.8538690.xyz`。

## 9. 错误处理

- 登录、策展读取、写入、迁移和剪贴板复制使用独立且可恢复的错误状态。
- API 响应统一为 `{ ok, data?, error? }`，错误码稳定，中文文案留在前端。
- Worker 读取到损坏 KV 时不写回空状态，避免数据丢失。
- 未登录状态收到 `401` 后前端立即退出管理显示并重新提示登录。
- 剪贴板 API 不可用时退回选中文本框，由用户手动复制。
- Embed 解码错误不会影响主站其他路由。

## 10. 测试与验收

### 10.1 单元测试

- 正确密码生成有效会话，错误密码失败且不泄露 Secret。
- 会话签名篡改、超时和错误 Origin 被拒绝。
- 登录失败计数与 429 锁定。
- 未授权用户不能添加、删除或迁移。
- KV 空值、合法值、损坏值与 V1 本机迁移。
- 五组随机约束均确定性生成，并满足对应权重、速度、offset、密度和边缘范围。
- 旧配方规范化为默认高级设置。
- Embed 配方往返一致、超限和畸形输入被拒绝。
- HTML 调用代码正确转义 origin 与属性。

### 10.2 shader 与渲染测试

- 新 uniforms 存在并由实验室和 RecipeAtlas 一致上传。
- 原子效果库 shader 与卡片结构不改变。
- Embed 只有一个 WebGL context 和一个 canvas。
- 离屏暂停与 reduced-motion 路径存在。

### 10.3 页面与浏览器验收

- 访客看不到任何写按钮。
- 登录后三个页面出现对应管理操作。
- 登录关闭浏览器后失效，退出后立即失效。
- 管理员添加作品后，新访客读取到同一作品。
- 首页与实验室复制的 iframe 在独立页面正常播放。
- 桌面、390px 移动端和键盘操作可用。
- 浏览器控制台无 WebGL、React 或 API 错误。

## 11. 部署配置

- 新建 Cloudflare KV namespace 并绑定为 `CURATION_KV`。
- 设置 `SPECTRA_ADMIN_PASSWORD` Secret。
- 设置随机生成的 `SPECTRA_SESSION_SECRET` Secret。
- 本地开发通过不提交的 `.dev.vars` 提供测试 Secret，并使用本地 KV 模拟。
- 部署后先验证登录，再由管理员选择是否同步本机旧策展。
- 不把 `.dev.vars`、密码或 Cookie 写入 Git。

## 12. 明确不做

- 不做多管理员、注册、找回密码或角色权限。
- 不做 D1 历史版本、审计日志或实时协作。
- 不做整页 HTML 导出、视频导出或离线 shader 包。
- 不给公开访客提供服务器端永久短链接生成，避免匿名写入与 KV 滥用。
- 不增加 UI、状态管理或压缩第三方依赖。

## 13. 商业化参照

最接近 SPECTRA FLUX 的已收费产品证明了“可视化创作 + 在线嵌入/导出”存在付费需求：

- Unicorn Studio：75+ WebGL 效果、无代码混合和网页嵌入；付费版按年约 14 美元/月，核心付费点是无标识发布、商业许可、JSON 与高质量导出。
- Spline：免费预览，12 美元/月起；更高档位出售代码导出、自托管、协作和去水印。
- Rive：免费创作，9 美元/月起用于正式发布；更高档位出售 embed hosting、团队库和企业能力。
- SVGator：20 美元/月起；付费点是无水印、交互动画、Player API、无限导出和团队协作。
- MagicPattern：创始人公开披露上线约八个月达到 1,000 美元 MRR；后续包含 MagicPattern 在内的三个独立产品组合公开达到约 6,500 美元 MRR。组合数字不能视为 MagicPattern 单品利润，但它是最接近的公开收入验证。

建议的 SPECTRA FLUX 商业路径不是立刻增加复杂订阅系统，而是先验证以下顺序：

1. 免费：浏览全部效果、带 SPECTRA 标识的有限嵌入。
2. 一次性创始版：去标识、商业使用、保存更多配方、完整 HTML/JSON 导出。
3. 订阅版：托管嵌入、私有作品、品牌色板、访问统计和更高发布额度。
4. 服务收入：为品牌、设计师和建站客户定制动态视觉包。

当前开发阶段只完成安全管理与公开 HTML 调用，不接支付。先观察嵌入次数、重复创作和用户主动索要去标识的需求，再决定是否建设付费系统。

商业参照来源：

- https://www.unicorn.studio/
- https://spline.design/pricing
- https://rive.app/pricing
- https://www.svgator.com/pricing
- https://www.indiehackers.com/post/9f395e6072
- https://www.indiehackers.com/post/heres-how-jim-raptis-left-the-vc-funding-world-behind-and-built-a-portfolio-of-bootstrapped-products-with-6-5k-mrr-NhCE9YTxvf9mqlDK8Ihx
