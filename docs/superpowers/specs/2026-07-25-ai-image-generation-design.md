# AI 生图设计

日期：2026-07-25
状态：已定稿，待实施

## 目标

为 mx-core 增加 AI 生图能力，服务两个场景：

1. **文章封面** — 在 admin 文章字段区，依文章内容生成封面图，存入 `meta.cover`
2. **编辑器插图** — 在写作过程中生成图片并插入正文

## 已决决策

| 议题 | 结论 |
|---|---|
| 生图 provider 配置 | 独立配置块，与文本 `aiOptions.providers` 分离 |
| 封面字段落点 | `posts.meta.cover`（jsonb），不新增列 |
| 请求形态 | 入 `TaskQueueService` 异步，返 taskId |
| prompt 来源 | 自动拟稿填入输入框，用户可改可弃，确认后生成 |
| 封面预设 | signal-geometry 单条先行，非并列多条 |
| 编辑器入口 | agent tool，不改 haklex |

## 一、运行时与配置

### pi-ai 的生图能力与约束

`@earendil-works/pi-ai@0.82.0` 已带生图 API，故不手写 `/images/generations`，仍守
`apps/core/CLAUDE.md`「尽走 pi runtime」之不变量：

```ts
generateImages(model, context, options) → AssistantImages
createImagesModels() → MutableImagesModels
registerImagesApiProvider({ api, generateImages })
```

**约束（要害）**：pi 的生图签名无任何画面参数。

```ts
ImagesContext = { input: (TextContent | ImageContent)[] }   // 仅提示词与参考图
```

无 size、无 quality、无 aspectRatio。内置 api 仅 `openrouter-images` 一家
（`dist/providers/images/register-builtins.js`，33 行，转 chat-completions 加
`modalities: ["image","text"]`）。

可用之缝有二：

- `ImagesOptions.onPayload(payload, model)` — 发送前改写 provider 载荷
- `registerImagesApiProvider({ api, generateImages })` — 自注册 api 实现

**故欲直连 OpenAI / Gemini，须自写 `ImagesApiProvider`，非配置了事。此为实工。**

### 两家 vendor 的参数实况

OpenAI `POST /v1/images/generations`（`gpt-image-1` / `-mini` / `1.5`）：

| 参数 | 值域 | 备注 |
|---|---|---|
| `size` | `1024x1024` `1536x1024` `1024x1536` `auto` | 绝对像素 |
| `quality` | `low` `medium` `high` `auto` | |
| `background` | `transparent` `opaque` `auto` | GPT image 独有 |
| `output_format` | `png` `jpeg` `webp` | |
| `output_compression` | 0–100 | 仅 jpeg/webp |
| `moderation` | `low` `auto` | |
| `n` | 1–10 | |
| `response_format` | — | GPT image 不支持，恒返 `b64_json` |

Gemini（`gemini-3-pro-image` / `3.1-flash-image` / `3.1-flash-lite-image`）：

| 参数 | 值域 | 备注 |
|---|---|---|
| `generationConfig.imageConfig.aspectRatio` | `1:1` `2:3` `3:2` `3:4` `4:3` `4:5` `5:4` `9:16` `16:9` `21:9` | 比例，非像素 |
| `generationConfig.imageConfig.imageSize` | `512px`(flash 限) `1K`(默认) `2K` `4K` | 分辨率档 |
| `mimeType` | `image/png` `image/jpeg` | |
| `thinking_level` | `minimal`(默认) `high` | 3.1 flash |
| 参考图 | 至多 14 张 | 按模型分对象/角色/风格 |
| 输出 | `inlineData.data` base64 + `mimeType`，单图 | 无 `n`，无透明背景 |

**不交之处**：OpenAI 论像素、Gemini 论比例；`background` / `n` /
`output_compression` Gemini 无；`imageSize` 档位、`thinking_level` OpenAI 无。

来源：
[OpenAI Create image](https://developers.openai.com/api/reference/resources/images/methods/generate)、
[Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)

### IImageRuntime

置于新建的 `modules/ai/ai-image/`，与 ai-summary / ai-translation 并列。
`image-runtime.adapter.ts` 仿 `pi-runtime.adapter.ts` 之形：

```ts
interface ImageGenerateOptions {
  prompt: string
  aspectRatio?: '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16'
  quality?: 'low' | 'standard' | 'high'
  format?: 'png' | 'jpeg' | 'webp'
  referenceImages?: { data: Buffer; mimeType: string }[]
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
}

interface IImageRuntime {
  generateImage(
    opts: ImageGenerateOptions,
  ): Promise<{ images: { buffer: Buffer; mimeType: string }[] }>
  listModels?(): Promise<ImageModelInfo[]>
}
```

采「中立核心 + 逃生舱」：`aspectRatio` / `quality` / `format` 三项中立，各 api
adapter 自译；vendor 独有能力经 `providerParams` 透传，由 `onPayload` 注入。

映射表：

| 中立值 | OpenAI | Gemini |
|---|---|---|
| `aspectRatio: '16:9'` | `size: '1536x1024'` | `aspectRatio: '16:9'` |
| `aspectRatio: '1:1'` | `size: '1024x1024'` | `aspectRatio: '1:1'` |
| `aspectRatio: '9:16'` | `size: '1024x1536'` | `aspectRatio: '9:16'` |
| 其余比例 | 取最近的 size | 原样传 |
| `quality: 'low'` | `quality: 'low'` | `imageSize: '1K'` |
| `quality: 'standard'` | `quality: 'medium'` | `imageSize: '1K'` |
| `quality: 'high'` | `quality: 'high'` | `imageSize: '2K'` |

不采纯中立词汇（会丢 `background: transparent`、`n`、`thinking_level`，且交集
随两家演进而失衡），亦不采纯原生直传（admin 表单与调用方须自知 vendor 差异，
换家即改）。

### 配置

新增 `imageGenerationOptions`，落 `configs.schema.ts`，与 `imageStorageOptions`
相邻：

| 字段 | 用 |
|---|---|
| `enable` | 总开关，关则两入口皆隐 |
| `provider` | pi images provider id（默认 `openrouter`） |
| `apiKey` / `endpoint` | 凭证与端点 |
| `model` | 生图模型 id |
| `defaultAspectRatio` | 默认比例，请求可覆盖 |
| `defaultQuality` | 默认精细档（`low` / `standard` / `high`），请求可覆盖 |
| `defaultFormat` | 默认输出格式（`png` / `jpeg` / `webp`），请求可覆盖 |

三个 default 字段与 `ImageGenerateOptions` 同词汇，不引入第二套尺寸说法。

与 `aiOptions.providers`（文本）全然独立。拟 prompt 那一跳仍用文本 provider。

## 二、生成管线与落盘

### 任务类型

`ai-task.types.ts` 增 `AITaskType.ImageGeneration`，payload：

```ts
{
  prompt: string                    // 终稿，拟词已在入队前完成
  purpose: 'cover' | 'inline'
  aspectRatio?: string
  quality?: string
  format?: string
  providerParams?: Record<string, unknown>
  refId?: string                    // cover 时为文章 id，仅作展示与归档
  requestId: string                 // 客户端生成，唯一
}
```

**去重须显式关掉。** `computeAITaskDedupKey` 新增之 case 必须把 `requestId`
纳入哈希。生图之常态是同一 prompt 连生数张比选；若沿用「同 payload 即同任务」，
第二次点击会静默返回第一次的 taskId，用户见其不动，以为坏了。

### 处理器

新增 `AiImageService`，`onModuleInit` 中
`taskProcessor.registerHandler({ type: ImageGeneration, ... })`，与
`AiSummaryService`（`ai-summary.service.ts:63`）同构。管线：

```
payload → IImageRuntime.generateImage()
        → { buffer, mimeType }
        → FileService.uploadBuffer()  →  { url, name }
        → createPendingReference(url, filename, objectKey?)
        → task result: { url, mimeType, prompt }
```

**错误须查 `stopReason`。** pi 生图失败不抛异常，而返
`AssistantImages { stopReason: 'error', errorMessage }`，`output` 为空数组。
handler 若只 try/catch，遇失败会拿到空 output 而当成功，落一张零字节图。
必须先判 `stopReason !== 'stop'` 则显式抛出。

### 落盘之重构

`file.controller.ts:218–288` 之 `uploadToS3` 闭包与其后本地分支，抽为服务方法：

```ts
FileService.uploadBuffer(buffer, {
  type: FileType
  originalFilename: string
  contentType: string
}): Promise<{ url: string; name: string }>
```

内含 S3/本地二选一、`generateFilename` / `generateFilePath` / `prefix` 模板、
以及 `createPendingReference`。controller 之 image/file 路径改调此法；video 之
`uploadStream` 路径不动（流不宜缓冲）。生图侧遂与手动上传共用同一套命名、前缀、
引用登记，无第二条落盘路。

存储本身无需新建：`imageStorageOptions` 开启则走 S3（`utils/s3.util.ts` 手写
SigV4），未开则落本地 `STATIC_FILE_DIR`。

### 生命周期

生成即 `pending`。文章存稿时既有逻辑扫正文与 `meta` 转 `active`；连生五张只留
一张，余四张仍 `pending`，由既有孤儿清理回收。无需为生图另写清理。

### 推送

`TaskQueueService` 之 emitter 已有 created/started/status，admin 经 room-subs
订阅即得完成通知，无需新 gateway。

## 三、两入口与 prompt 策略

### 封面预设：signal-geometry

取自 [CaliCastle/skills](https://github.com/CaliCastle/skills/blob/main/skills/signal-geometry)，
MIT，© 2026 Cali Castle。此非风格短语，乃一整套 prompt 编译规程：视觉不变量
（留白 70–95%、笔触 2–8%、三级对比、灰度为主 + <0.2% 强调色）、五种语法族
（orbital / flow / signal / topology / layered）、九轴配方、四段式终稿结构、
通过闸与否决清单。

预设结构：

```ts
interface CoverStylePreset {
  id: string
  label: string
  defaultAspectRatio: string   // signal-geometry → '16:9'
  compileSystemPrompt: string  // 指导文本模型如何蒸馏文章为该风格终稿
  hardConstraints: string      // 恒附于终稿：无文字、否决清单
}
```

拟词一跳的 system prompt 由 preset 提供，而非通用模板——文本模型照九轴逐项决断
（family / transformation / geometry / scaffold / anchor / accent / polarity /
format / text），产出四段式终稿。九轴可结构化为 TypeBox schema，落在既有
`Value.Check` 那条路上。

**取舍**：此 skill 有两步依赖视觉回环，本设计无，故弃之——

- Step 3 例图锚定（读 `references/example-index.md`、检视样图定质量基准）
- Step 7 inspect-and-repair（看图、判闸、改 prompt 重生一次）

只取视觉不变量、九轴配方、四段式结构、否决清单，后四者纯文本，可全数落入
`compileSystemPrompt` 与 `hardConstraints`。日后若欲补 QA 回环，管线加一步
「视觉模型判闸 → 不过则改 prompt 重入队」即可，任务队列本就支持重试，接口不必改。

`no text by default` 这条对封面尤其要紧——生图模型渲染文字必糊，此闸省去大量废图。
其默认 `16:9` 与封面正合，`4:5` 备海报之用。

蒸馏其规程入 `ai.prompts.ts` 时留一行 attribution：
`Signal Geometry preset adapted from CaliCastle/skills, MIT`。此为法律声明，
不在「零注释」之禁列。

### 拟词一跳

文本模型依 `title` + `summary` 产出主体描述与九轴配方，与预设拼成终稿。产出须走
TypeBox schema + `Value.Check`（`apps/core/CLAUDE.md` 之 lint gate：
`validate: false` 必须 30 行内配 `Value.Check`）。

拟词 prompt 中须**限定输出英文**——生图模型对中文提示词普遍弱，此处不随文章语言。

### 甲、封面入口

置于 admin 文章字段区，按钮「AI 生成封面」开抽屉：

1. 开时即发 `POST /ai/image/draft-prompt`，拟出终稿填入文本框
2. 预设以 chip 列出（当下仅 signal-geometry 一条）
3. 确认 → `POST /ai/image/generate` 入队，返 taskId
4. 完成经 room-subs 推回，缩略图累积为候选列表（同一抽屉内可连生数张）
5. 点选一张 → 写入 `meta.cover`；未选者留 `pending`，日后由孤儿清理回收

### 乙、编辑器入口

在 `tools` 数组（`WriteRouteViewsContent.tsx:3638`）中注册 `generate_image`
agent tool，复用既有 `toolcall → insert_node` 通道与渲染。**haklex 无需改动**，
admin 只加一个 tool 定义。

不采斜杠命令/工具栏按钮方案——那须改 haklex（独立仓），发版后再回改 mx-core 的
pin 版本，跨仓一轮。若日后确觉入口太深，再补 UI 不迟，届时 runtime 与 API 皆已
就绪。

编辑器内 prompt 保持自由输入，不挂预设（预设只服务封面）；agent 已持全文上下文，
拟词一跳可省。

## 四、API 契约

依 `@ApiController()` 前缀，四个新端点，皆 `@Auth()`：

```
POST /ai/image/draft-prompt   @HttpCode(200)
  body { presetId, refId? } | { presetId, title, summary }
  → { prompt: string, recipe: { family, transformation, geometry,
      scaffold, anchor, accent, polarity, format, text } }

POST /ai/image/generate       @HttpCode(200)
  body { prompt, presetId?, aspectRatio?, quality?, format?,
         providerParams?, purpose: 'cover'|'inline',
         refId?, requestId }
  → { taskId, created }

GET  /ai/image/presets        → [{ id, label, defaultAspectRatio }]
GET  /ai/image/models         → pi ImagesModels 列表，仿 /ai/registry/models
```

两个 POST 皆动作式非创建式，故须 `@HttpCode(200)`（见 `49a257221`，NestJS 默认
201）。

**任务查询不新增**：`GET /tasks/:id` 已在（`task.controller.ts:47`），实时更新走
既有 room-subs。生图只是又一种 task，不该有自己的一套查询。

**刻意不加 `@HTTPDecorators.Idempotence()`**。此与去重那条同源：连点两次「生成」
本就该出两张不同的图，幂等在此处是反功能。

**`providerParams` 无需 `@BypassCaseTransform`**——请求体只在顶层折驼峰，嵌套
对象原样透传，故 `{ output_compression: 50 }` 能完好抵达 vendor。但
`GET /tasks/:id`（`task.controller.ts:47`）裸返回整个 task（含 `payload`），未加
`@BypassCaseTransform`，出站转换会递归深入 —— 故 task 详情接口其实会将
`payload` 原样回显，嵌套的 vendor 键在响应中会被转 snake_case。当前两个入口均
不发送 `providerParams`，重试也只读 Redis 中的原始 payload，故此路径暂无实际
影响；但日后若要在响应中回显 `providerParams`，`task.controller.ts` 需补
`@BypassCaseTransform`。

**视图**：新建 `ai-image.views.ts`，controller 层解析后返回，不裸传 service 结果。

## 五、错误与测试

`ErrorCodeEnum` 增三条：

- `ImageGenerationDisabled` — 未开 `imageGenerationOptions.enable`
- `ImageProviderNotConfigured` — 缺 apiKey / model
- `ImageGenerationFailed` — pi 返 `stopReason: 'error'`，带 `errorMessage` 入
  `details`

测试三层：

1. **单元** — 各 adapter 之参数映射表（`16:9` → OpenAI `1536x1024` / Gemini
   `aspectRatio: '16:9'`；`quality` 三档映射）。纯函数，无网络
2. **faux e2e** — 仿 `ai.controller.faux.e2e.spec.ts`，以进程内 stand-in 替 pi
   images，覆盖三条：入队返 taskId；同 prompt 两次请求得两个不同 taskId
   （去重关闭之回归）；`stopReason: 'error'` 须抛而非落空图
3. **live** — 归入既有 `RUN_LIVE_TESTS=1` 闸下，不入 CI

`stopReason` 那条与去重那条是本设计仅有的两个静默失败点，故各配一条回归用例钉死。

## 影响面

新增：

- `apps/core/src/modules/ai/ai-image/`（service、runtime adapter、controller、
  views、prompts）
- `imageGenerationOptions` 配置块
- `AITaskType.ImageGeneration` 与其 dedup case
- 三条 `ErrorCodeEnum`
- admin：封面抽屉、`generate_image` agent tool

改动：

- `FileService` 增 `uploadBuffer`，`file.controller.ts` 之 image/file 上传路径
  改调之
- `ai.prompts.ts` 增 signal-geometry 预设与拟词 schema

不动：

- haklex
- `utils/s3.util.ts` 与 `imageStorageOptions`
- `FileReference` 生命周期与孤儿清理
- `TaskQueueService` 与 `task.controller.ts`
