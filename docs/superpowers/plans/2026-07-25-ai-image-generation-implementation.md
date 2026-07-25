# AI 生图实施计划

Spec: `docs/superpowers/specs/2026-07-25-ai-image-generation-design.md`
日期：2026-07-25

## Global Constraints

这些约束绑定每一个任务，实施者与审查者皆须照此判定。

1. **零注释**。默认不写任何注释、不写 JSDoc。仅当代码存在意外行为（库的坑、竞态、
   浏览器怪癖）或隐藏不变量时才写。禁止：描述代码做什么、引用本次任务/PR、分节
   标题（`// === helpers ===`）、把标识符翻译成散文、内部函数的 docstring。
   唯一例外是 Task 5 的 license attribution 行。

2. **响应信封**。controller 返回裸值 `T` → `{ data: T }`；需要 meta 时用
   `withMeta(data, meta)`。绝不返回顶层含 `data` 键的对象字面量。错误一律用
   `createAppException(AppErrorCode.X, payload)`（自 `~/common/errors` 导入）。
   注意：根 CLAUDE.md 中提到的 `ErrorCodeEnum` / `BizException` 在本仓**不存在**，
   是过时文档，勿照其写。真实模式见 `apps/core/src/common/errors/`。

3. **动作式 POST 须 `@HttpCode(200)`**。NestJS 默认 201，仅创建资源才用 201。
   见 commit `49a257221`。

4. **camelCase 贯穿代码**，wire 层由 `ResponseInterceptor` 自动转 snake_case。
   controller 中绝不手动调用 snakeCase 类的辅助函数。

5. **TypeBox + `Value.Check`**。结构化输出用 TypeBox schema（非 Zod）。任何传给
   pi 的 `validate: false` 必须在 30 行内配一个 `Value.Check(schema, value)` ——
   这是 CI 检查项。

6. **DTO 用 Zod + `createZodDto`**（请求校验），与 TypeBox（LLM 结构化输出）分属
   两层，不要混用。

7. **测试**：faux e2e 用进程内 stand-in 替 pi，绝不打真实网络。live 测试归入
   `RUN_LIVE_TESTS=1` 闸下。

8. **只 lint/typecheck 改动的文件**，不要对整个项目跑检查。
   `pnpm -C apps/core exec tsc --noEmit` 之类的全量命令不要用；用 eslint 指定
   文件路径。

9. **不改 haklex**（独立仓）。不改 `utils/s3.util.ts`。不改 `TaskQueueService`
   与 `task.controller.ts`。

10. **文件行数**：单文件 500 行以内，React 组件 300 行以内。

## 依赖关系

```
Task 1 (配置 + 错误码)
   ↓
Task 2 (IImageRuntime)      Task 3 (FileService.uploadBuffer)
   ↓                              ↓
   └──────── Task 4 (任务管线) ────┘
                  ↓
Task 5 (preset + 拟词) → Task 6 (controller + e2e)
                              ↓
                     ┌────────┴────────┐
                  Task 7            Task 8
                (封面抽屉)      (agent tool)
```

---

## Task 1: 配置块与错误码

在 `apps/core/src/modules/configs/configs.schema.ts` 中新增 `imageGenerationOptions`
配置块，位置紧邻既有的 `imageStorageOptions`。

字段（全部可选，除 `enable`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `enable` | boolean | 总开关 |
| `provider` | string | pi images provider id，默认 `'openrouter'` |
| `apiKey` | string | 凭证 |
| `endpoint` | string | 端点 |
| `model` | string | 生图模型 id |
| `defaultAspectRatio` | string | 默认比例，默认 `'16:9'` |
| `defaultQuality` | string | `'low' \| 'standard' \| 'high'`，默认 `'standard'` |
| `defaultFormat` | string | `'png' \| 'jpeg' \| 'webp'`，默认 `'png'` |

照既有 `imageStorageOptions` 的写法使用 `field.toggle` / `field.plain` /
`field.halfGrid` 等 DSL 辅助函数，保持同样的 label 与 description 风格（英文）。
apiKey 须走既有的加密字段处理方式——先读 `configs.encrypt.util.ts` 看现有 secret
字段（如 `imageStorageOptions.secretKey`）如何声明，照做。

在 `apps/core/src/common/errors/` 中新增三条 `AppErrorCode`（SCREAMING_SNAKE_CASE，须同时改 `app-error-code.ts`、`app-error-definitions.ts`、`app-error-payload.ts`）：

- `IMAGE_GENERATION_DISABLED` — 未开启 `imageGenerationOptions.enable`，HTTP 400
- `IMAGE_PROVIDER_NOT_CONFIGURED` — 缺 apiKey 或 model，HTTP 400
- `IMAGE_GENERATION_FAILED` — 生成失败，HTTP 500，payload 用 `OptMessage` 承载
  底层错误信息

照文件中既有条目的格式（消息文案、状态码）添加。

**验收**：`pnpm -C apps/core exec eslint <改动的文件>` 通过；配置默认值能被
`ConfigsService.get('imageGenerationOptions')` 读到。写一个最小单测验证默认值
（若 `configs` 已有同类测试文件则追加进去，否则不必新建）。

---

## Task 2: IImageRuntime 与 pi images adapter

新建目录 `apps/core/src/modules/ai/ai-image/`，其中：

`image-runtime.interface.ts`：

```ts
export interface ImageGenerateOptions {
  prompt: string
  aspectRatio?: '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16'
  quality?: 'low' | 'standard' | 'high'
  format?: 'png' | 'jpeg' | 'webp'
  referenceImages?: { data: Buffer; mimeType: string }[]
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
}

export interface GeneratedImage {
  buffer: Buffer
  mimeType: string
}

export interface IImageRuntime {
  generateImage(
    opts: ImageGenerateOptions,
  ): Promise<{ images: GeneratedImage[] }>
  listModels?(): Promise<{ id: string; provider: string }[]>
}
```

`image-runtime.adapter.ts`：以 `@earendil-works/pi-ai` 的
`createImagesModels()` / `generateImages()` 实现 `IImageRuntime`。参考
`apps/core/src/modules/ai/runtime/pi-runtime.adapter.ts` 的构造与配置注入写法。

关键实现点：

- pi 的 `ImagesContext` 只有 `{ input: (TextContent | ImageContent)[] }`，**没有
  任何画面参数**。中立参数须通过 `ImagesOptions.onPayload(payload, model)` 回调
  注入到 provider 载荷。
- 从 `AssistantImages.output` 中筛出 `ImageContent` 转为 Buffer。
- **失败判定**：pi 生成失败不抛异常，而是返回
  `{ stopReason: 'error', errorMessage, output: [] }`。必须先判
  `stopReason !== 'stop'`，然后抛
  `createAppException(AppErrorCode.IMAGE_GENERATION_FAILED, { message: errorMessage })`
  （该错误码的 payload 类型是 `OptMessage`）。若不判，会静默落一张零字节图。

`image-param-mapping.ts`：纯函数，中立参数 → vendor 载荷片段。

OpenAI 侧：

| 中立 | OpenAI |
|---|---|
| `aspectRatio: '16:9'` | `size: '1536x1024'` |
| `aspectRatio: '1:1'` | `size: '1024x1024'` |
| `aspectRatio: '9:16'` | `size: '1024x1536'` |
| `aspectRatio: '3:2'` | `size: '1536x1024'` |
| `aspectRatio: '2:3'` | `size: '1024x1536'` |
| `aspectRatio: '4:3'` | `size: '1536x1024'` |
| `aspectRatio: '3:4'` | `size: '1024x1536'` |
| `quality: 'low'` | `quality: 'low'` |
| `quality: 'standard'` | `quality: 'medium'` |
| `quality: 'high'` | `quality: 'high'` |
| `format` | `output_format` |

Gemini 侧：

| 中立 | Gemini |
|---|---|
| `aspectRatio` | `generationConfig.imageConfig.aspectRatio`（原样） |
| `quality: 'low'` | `imageSize: '1K'` |
| `quality: 'standard'` | `imageSize: '1K'` |
| `quality: 'high'` | `imageSize: '2K'` |
| `format: 'png'` | `mimeType: 'image/png'` |
| `format: 'jpeg'` | `mimeType: 'image/jpeg'` |
| `format: 'webp'` | Gemini 不支持，退回 `image/png` |

`providerParams` 在映射之后浅合并进载荷，用户显式给的值覆盖映射结果。

**验收**：新建 `image-param-mapping.spec.ts`，逐条覆盖上面两张表（纯函数，无网络）。
`pnpm -C apps/core exec vitest run <该 spec 文件>` 全绿。

---

## Task 3: FileService.uploadBuffer 抽取

`apps/core/src/modules/file/file.controller.ts` 的 `upload` 方法（约 208–344 行）
目前把 S3 上传逻辑写在一个内联闭包 `uploadToS3` 里，本地落盘逻辑写在其后。把
**buffer 路径**抽为服务方法，供生图侧复用。

在 `apps/core/src/modules/file/file.service.ts` 新增：

```ts
uploadBuffer(
  buffer: Buffer,
  opts: {
    type: FileType
    originalFilename: string
    contentType: string
  },
): Promise<{ url: string; name: string }>
```

方法内部须完整包含：

1. 读 `fileUploadOptions` 与 `imageStorageOptions`
2. S3 开启且 type 属 image/file/video → 走 S3 分支：`generateFilename`、
   `config.prefix` 的 `replaceFilenameTemplate` 处理、`new S3Uploader(...)`、
   `setCustomDomain`、`uploadBuffer`、`createPendingReference(url, filename, objectKey)`
3. 否则走本地分支：`generateFilename`、`generateFilePath`、`writeFile`、
   `resolveFileUrl`，且仅当 `type === 'image'` 时 `createPendingReference(url, relativePath)`
4. S3 配置不全时抛 `AppErrorCode.FILE_STORAGE_NOT_CONFIGURED`

然后改造 `file.controller.ts`：image 与 file 类型的上传改为读完 multipart 流成
Buffer 后调用 `this.service.uploadBuffer(...)`。

**video 的 `uploadStream` 路径保持原样不动**——视频流不应缓冲进内存。也就是说
controller 里仍保留 video 的独立分支。

注意 `FileService` 可能需要新注入 `FileReferenceService` / `ConfigsService`，
留意循环依赖（`FileReferenceService` 是否已依赖 `FileService`）。若存在循环，用
`forwardRef` 或把该方法放到一个新的 `FileUploadService` 中——由实施者判断，但
须在报告中说明选择理由。

**验收**：现有 file 相关测试全绿（`pnpm -C apps/core exec vitest run test/src/modules/file`
或对应路径）。手动上传行为不得有任何可观察变化：同样的 URL 形态、同样的
pending reference 登记。

---

## Task 4: 任务类型与生成管线

在 `apps/core/src/modules/ai/ai-task/ai-task.types.ts`：

1. `AITaskType` 枚举增 `ImageGeneration = 'ai:image:generation'`（照既有条目的命名
   风格）
2. 新增 payload 类型：

```ts
export interface ImageGenerationTaskPayload {
  prompt: string
  purpose: 'cover' | 'inline'
  aspectRatio?: string
  quality?: string
  format?: string
  providerParams?: Record<string, unknown>
  refId?: string
  requestId: string
}
```

3. `computeAITaskDedupKey` 增 `ImageGeneration` 的 case。**这个 case 必须把
   `requestId` 纳入哈希**。原因：生图的常态是同一 prompt 连生数张比选；若沿用
   「同 payload 即同任务」的去重，第二次点击会静默返回第一次的 taskId，前端看到
   任务不动，以为坏了。这是本设计仅有的两个静默失败点之一。

在 `ai-task.service.ts` 增 `createImageGenerationTask(payload)`，照既有
`createSummaryTask` 等方法的形状。

新建 `apps/core/src/modules/ai/ai-image/ai-image.service.ts`：

- `onModuleInit` 中 `this.taskProcessor.registerHandler({ type: AITaskType.ImageGeneration, ... })`，
  照 `apps/core/src/modules/ai/ai-summary/ai-summary.service.ts:63` 的写法
- handler 管线：

```
payload
  → 校验 imageGenerationOptions.enable（否则抛 AppErrorCode.IMAGE_GENERATION_DISABLED）
  → 校验 apiKey/model（否则抛 AppErrorCode.IMAGE_PROVIDER_NOT_CONFIGURED）
  → IImageRuntime.generateImage()
  → 取首张 { buffer, mimeType }
  → FileService.uploadBuffer(buffer, { type: 'image', originalFilename, contentType: mimeType })
  → 返回 task result: { url, mimeType, prompt }
```

`originalFilename` 用 `ai-cover-<requestId>.<ext>` 之类的形式，扩展名由 mimeType
推出。

新建 `ai-image.module.ts`，并在 `ai.module.ts` 中引入。

**验收**：`pnpm -C apps/core exec eslint <改动文件>` 通过。新建
`ai-image.service.spec.ts` 或在 faux e2e 中覆盖：(a) 同一 prompt 两次
`createImageGenerationTask`（不同 requestId）得到两个不同 taskId；(b) runtime 返回
`stopReason: 'error'` 时 handler 抛出而非静默成功。这两条是回归钉。

---

## Task 5: signal-geometry 预设与拟词

在 `apps/core/src/modules/ai/ai.prompts.ts` 中新增封面预设与拟词 prompt。

预设结构：

```ts
interface CoverStylePreset {
  id: string
  label: string
  defaultAspectRatio: string
  compileSystemPrompt: string
  hardConstraints: string
}
```

当前只实现一条：`signal-geometry`，`defaultAspectRatio: '16:9'`。

`compileSystemPrompt` 须把下列 Signal Geometry 规程蒸馏进去，指导文本模型如何把
文章内容编译成终稿 prompt：

- **视觉不变量**：单一空间事件（orbit / convergence / divergence / compression /
  deflection / propagation / oscillation / filtering / enclosure / release 择一）；
  安静场（背景留白 70–95%，笔触覆盖 2–8%）；明暗双极等价（浅色用中性米白纸，
  深色用炭黑染纸）；材质是全幅平铺的无涂层哑光纸，有细微不规则纹理与纤维，不要
  边框、不要 mockup 立体感、不要边缘阴影、不要污渍撕裂做旧；精确笔触（细线、弧、
  点、节点、粒子、克制的排线、网格、线框网），三级对比层次（微弱骨架 / 可读结构 /
  极少数明亮锚点）；默认灰度，若色彩承载意义则用一枚珊瑚色、橙红或钴蓝的针尖强调，
  覆盖率低于 0.2%；编辑性收尾——清晰、正交、冷静、分析性、略带思辨。
- **五种语法族**（择一为主，至多加一种从属笔触语言）：orbital field（周期、引力、
  递归、尺度、相互影响 → 圆、弧、径向刻度、环、球面网）；flow transformation
  （涌现、路由、过滤、压力、变化 → 流线、粒子、箭头、闸门、障碍）；signal strip
  （节奏、韵律、阶段、比较、累积 → 波形、泳道、条、重复度量、微弱网格）；topology
  map（关系、语境、系统、依赖 → 节点、边、框、稀疏模块）；layered field（张力、
  阈值、重叠、潜在深度 → 直纹面、排线、等高线、线框曲面）。
- **九轴配方**，每轴恰好一个值：format / polarity（light | dark）/ family /
  transformation（一个动词）/ geometry（radial | bilateral | directional | paired |
  distributed | vertically staged）/ scaffold（open field | faint grid | framed
  region | baseline）/ anchor（off-white endpoint | central node | contrast line |
  structural void | none）/ accent（none | coral | orange-red | cobalt）/ text。
- **四段式终稿结构**：① 画布、比例、明暗极性、哑光纸材质、留白目标；② 空间命题、
  语法族、变换、几何、焦点位置；③ 笔触词汇、三级对比、可选微强调、精确的文字策略；
  ④ 平面编辑性收尾与否决约束。

`hardConstraints` 须包含**文字闸**与**否决清单**：默认完全不要文字（无字母、
数字、水印、伪文字）；拒绝产出 dashboard、信息图、产品界面、科幻 HUD、彩色数据
可视化、通用渐变色块、摄影场景、角色插画、拼贴、做旧 zine、光泽 3D 渲染。

**不实现**该 skill 的两个步骤：例图锚定（读 reference 图集定质量基准）与
inspect-and-repair（看图判闸后重生一次）。二者都需要视觉回看，本设计的生成管线是
单程的。

拟词的结构化输出用 **TypeBox** schema（非 Zod），产出九轴配方 + 四段式终稿文本。
照 `ai.prompts.ts` 中既有 prompt 的写法：`Type.Object({...}, { additionalProperties: false })`，
并配 `Value.Check`。

**拟词 prompt 中须明确要求输出英文** —— 生图模型对中文提示词普遍较弱，此处不随
文章语言。

文件顶部（或预设定义处）保留一行 license attribution：

```
Signal Geometry preset adapted from CaliCastle/skills, MIT
```

这是法律声明，是 Global Constraint 1「零注释」的唯一例外。

**验收**：若 `ai-prompts-schema.regression.spec.ts` 存在，按其约定为新 schema 补
fixture（该文件用约 50 组模拟 LLM 输出钉住通过/失败判定，新增 schema 须扩展这个
fixture 套件）。`pnpm -C apps/core exec vitest run <相关 spec>` 全绿。

---

## Task 6: controller、views 与 faux e2e

新建 `apps/core/src/modules/ai/ai-image/ai-image.controller.ts`，四个端点，
全部 `@Auth()`：

```
POST /ai/image/draft-prompt   @HttpCode(200)
  body { presetId, refId? } | { presetId, title, summary }
  → { prompt: string, recipe: {九轴} }

POST /ai/image/generate       @HttpCode(200)
  body { prompt, presetId?, aspectRatio?, quality?, format?,
         providerParams?, purpose, refId?, requestId }
  → { taskId, created }

GET  /ai/image/presets        → [{ id, label, defaultAspectRatio }]
GET  /ai/image/models         → [{ id, provider }]
```

要点：

- 两个 POST 都是动作式而非创建资源，必须 `@HttpCode(200)`（Global Constraint 3）
- **不要加 `@HTTPDecorators.Idempotence()`**。连点两次「生成」本就应该产出两张
  不同的图，幂等在此处是反功能——这与 Task 4 的去重决定同源
- 响应中**不回显 `providerParams`**。请求体只在顶层折驼峰，嵌套对象原样透传，
  所以 `{ output_compression: 50 }` 能完好抵达 vendor；但如果回显，出站的
  snake_case 转换会把 vendor 键改形
- **不新增任务查询端点**。`GET /task/:id` 已存在于 `task.controller.ts:47`，
  实时更新走既有的 room-subs。生图只是又一种 task
- 新建 `ai-image.views.ts` 定义 Zod 视图，controller 层解析后返回，不裸传 service
  结果
- 请求 DTO 用 Zod + `createZodDto`，放 `ai-image.dto.ts`

`GET /ai/image/models` 参照 `GET /ai/registry/models` 的实现（5 分钟内存缓存 +
stale-while-revalidate），数据源是 pi 的 `ImagesModels.getModels()`。

**验收**：新建 faux e2e `test/src/modules/ai/ai-image.faux.e2e.spec.ts`，用进程内
stand-in 替代 pi images（参考 `ai.controller.faux.e2e.spec.ts` 的 mock 方式，
绝不打真实网络）。必须覆盖：

1. `POST /ai/image/generate` 入队并返回 taskId
2. 同一 prompt、不同 requestId 的两次请求得到两个**不同的** taskId
3. runtime 返回 `stopReason: 'error'` 时任务失败并带 `errorMessage`，不产生零字节图
4. 未开 `enable` 时返回 `IMAGE_GENERATION_DISABLED`
5. 两个 POST 的成功响应状态码是 **200**

---

## Task 7: admin 封面生成抽屉

在 `apps/admin` 的文章编辑页字段区，加一个「AI 生成封面」按钮，点击开抽屉。

交互流程：

1. 抽屉打开时立即调 `POST /ai/image/draft-prompt`，把返回的终稿 prompt 填进一个
   可编辑的多行文本框
2. 预设以 chip 形式列出（当前只有 signal-geometry 一条），默认选中
3. 点「生成」→ 调 `POST /ai/image/generate`，前端生成 `requestId`（`crypto.randomUUID()`）
4. 用既有的 socket / room-subs 机制监听任务完成（参考 admin 中既有的 AI 任务
   进度订阅写法，如 summary/translation 的处理），完成后把缩略图追加进候选列表
5. 同一抽屉内可反复生成，候选列表累积
6. 点选某张 → 写入文章的 `meta.cover` 字段

技术约束：

- API 层放 `apps/admin/src/api/`，用既有 `http.ts` 辅助函数
- 用 TanStack Query，数组提取按 admin 约定：
  `select: (res: any) => Array.isArray(res) ? res : res?.data ?? []`
- 灰阶必须用 `neutral` 而非 `gray`
- 用 Design System v2 语义 token（`bg-surface-card`、`text-fg-muted`、
  `border-border` 等），不要裸 `bg-white` / `bg-neutral-*`
- 不要任意字号（不要 `text-[13px]`），用标准 Tailwind 档位
- focus ring 用统一写法：
  `focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15`
- 组件 300 行以内，超了就拆
- 文案走 i18n（`apps/admin/src/i18n/resources/` 下 en-US 与 zh-CN 都要加）
- `imageGenerationOptions.enable` 为 false 时整个入口隐藏

**验收**：`pnpm --filter @mx-admin/admin exec tsc --noEmit --pretty false` 对改动
文件无新增错误；eslint 通过。

---

## Task 8: admin generate_image agent tool

在 `apps/admin/src/features/write/components/WriteRouteViewsContent.tsx` 的
`editorOptions.tools` 数组（约 3638 行，现有 `buildMetaTools`）中，注册一个新的
agent tool `generate_image`，让编辑器内的 AI agent 能生成图片并插入正文。

要点：

- 参照 `buildMetaTools` 的定义方式新建 `buildImageTools`（放在合适的模块里，
  不要塞进已经很大的 `WriteRouteViewsContent.tsx`）
- tool 参数：`prompt`（必填）、`aspectRatio`（可选）
- tool 执行：调 `POST /ai/image/generate`（`purpose: 'inline'`，前端生成
  `requestId`），等任务完成拿到 url
- 拿到 url 后通过既有的 `toolcall → insert_node` 通道插入图片节点。先读
  `apps/admin/src/features/write/components/agent/agent-operations.ts` 与
  `use-write-agent.ts`，搞清 haklex 的 `insert_node` 工具调用如何回写编辑器，
  照同样的路径插入 image 节点
- **不要改 haklex**（Global Constraint 9）。这个任务只在 admin 侧加 tool 定义与
  插入逻辑
- 编辑器内的 prompt 保持自由输入，**不挂预设**（预设只服务封面）；agent 已持有
  全文上下文，拟词那一跳可省
- `imageGenerationOptions.enable` 为 false 时不注册这个 tool

**验收**：`pnpm --filter @mx-admin/admin exec tsc --noEmit --pretty false` 对改动
文件无新增错误；eslint 通过。若 `agent/` 目录下已有 jsdom vitest 测试，为新 tool
补一个最小用例。
