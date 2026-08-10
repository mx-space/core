# Admin AI 生成弹窗：多语言输入与强制重新生成

日期：2026-08-10
范围：`apps/admin` AI 模块生成弹窗 + `apps/core` AI 任务 force 语义

## 背景

admin AI 模块四种生成（摘要 Summary、精读 Insights、翻译 Translation、朗读 TTS）
共用一个弹窗 `apps/admin/src/features/ai/components/article-grouped/GeneratePromptModal.tsx`。
现状：

- 弹窗只有一个单行语言输入，默认 `zh`，产出 `{ lang?: string }`，只能派发单语言任务。
- 后端 task payload 本就接受数组（`SummaryTaskPayload.targetLanguages`、
  `TranslationTaskPayload.targetLanguages`、`TtsTaskPayload.langs`），单语言限制纯粹
  来自前端。
- `force` 仅 TTS 有。summary / insights / translation 重复生成会命中
  `AiInFlightService` 的结果缓存（Redis `resultKey`，`AI_STREAM_RESULT_TTL = 10 * 60`）
  而直接复用旧结果；translation 还会走块级增量复用，未变段落不重译。
- 精读任务无语言参数：正文按文章源语言生成，译文由独立的 `ai:insights:translation`
  任务承担。

## 目标

1. 弹窗语言输入支持逗号分隔。
2. 一次提交派发覆盖多种语言的任务。
3. 增加「强制重新生成」选项，且后端真正全量重生。

## 非目标

- 不改翻译页的「翻译全部」（`/ai/translations/task/all`）与 batch 接口——它们无弹窗。
- 不给精读加语言参数。精读弹窗只出现「强制重新生成」。
- 不做标签式（chips input）交互组件。
- 不动 `apps/admin/src/features/write/components/tts/TtsGenerationDrawer.tsx`
  与词条页 `AiTranslationEntriesRouteView`——两者都不是语言输入弹窗。

## 设计

### 1. 弹窗 `GeneratePromptModal`

```ts
export interface GeneratePromptModalProps {
  title: string
  promptForLang: boolean
  langLabel: string
  inlineEmpty?: string
  defaultLangs?: string[]
}

export interface GeneratePromptResult {
  langs: string[]
  force: boolean
}
```

- 语言仍是单行 `TextInput`，逗号分隔；半角 `,` 与全角 `，` 都作分隔符。
- 输入框下方实时渲染解析结果：每个语言一个 chip，附总数。
- 「强制重新生成」用 `~/ui/primitives/checkbox` 的 `Checkbox`，四种生成一律显示；
  `promptForLang: false`（精读）时弹窗只剩它和一行说明文案。
- 提交时语言可以为空数组：语义是「按设置」，见 §3。
- 语言数超过 `MAX_LANGS = 8` 时禁用提交按钮并显示错误提示。8 对齐后端
  `apps/core/src/modules/ai/ai-tts/ai-tts.service.ts` 的 `MAX_LANGS_PER_TASK`。
- 初始值取 `props.defaultLangs?.join(', ') ?? ''`。

### 2. 解析器

置于 `apps/admin/src/features/ai/utils/ai.ts`：

```ts
export function parseLangInput(raw: string): string[]
```

按 `[,，]` 拆分 → `trim` → `toLowerCase` → 剔除空串 → 去重且保持首次出现顺序。

### 3. 默认语言来源

新 hook `apps/admin/src/features/ai/hooks/use-ai-default-langs.ts`：

```ts
export function useAiDefaultLangs(
  optionKey?: 'summaryTargetLanguages' | 'translationTargetLanguages',
): string[]
```

内部 `useQuery` 调 `getOption('ai')`（`apps/admin/src/api/options.ts`），长 `staleTime`，
`enabled: Boolean(optionKey)`。摘要取 `summaryTargetLanguages`，翻译取
`translationTargetLanguages`；朗读与精读不传 `optionKey`，默认空。

留空提交对应后端既有行为：`resolveTargetLanguages(explicit, configured)` 在
`explicit` 为空时回退配置；TTS 在 `payload.langs` 为空时回退文章源语言。

### 4. 配置类型与调用点

`apps/admin/src/features/ai/components/article-grouped/types.ts`：

```ts
generate: {
  labelKey: TranslationKey
  icon: LucideIcon
  promptForLang?: boolean
  defaultLangsOptionKey?: 'summaryTargetLanguages' | 'translationTargetLanguages'
  runTask: (input: {
    refId: string
    langs?: string[]
    force?: boolean
  }) => Promise<{ created: boolean; taskId: string }>
  taskTypeForQueue: 'Insights' | 'Summary' | 'Translation' | 'Tts'
}
```

各路由 `runTask` 映射：

| 页面 | 调用 |
|---|---|
| Summary | `createSummaryTask({ refId, targetLanguages: langs, force })` |
| Translation | `createTranslationTask({ refId, targetLanguages: langs, force })` |
| Tts | `createTtsTask({ refId, langs, force })` |
| Insights | `createInsightsTask({ refId, force })` |

`ArticleGroupedDetailRoute.handleGenerate` 传 `defaultLangs`（来自
`useAiDefaultLangs(config.generate.defaultLangsOptionKey)`），把
`{ langs, force }` 透传给 `generateMutation`。

`apps/admin/src/features/ai/hooks/use-ai-quick-actions.ts` 同样改造：三个带语言的项走
同一弹窗并携带 `langs` 数组；精读项由「直接派发」改为「先弹窗」，以便取到 force。

行内 `extraItemActions` 的 `retranslate` / `regenerate` 保持单语言、不弹窗，一律
`force: true`。TTS 的 `buildTtsRegeneratePayload` 已是该语义，不变。

### 5. 后端

**DTO**（`apps/core/src/modules/ai/ai-task/ai-task.dto.ts`、
`ai-insights/ai-insights.schema.ts`）：`CreateSummaryTaskSchema`、
`CreateTranslationTaskSchema`、`CreateInsightsTaskSchema` 各加
`force: z.boolean().optional()`。`ai-task.types.ts` 的 `SummaryTaskPayload`、
`TranslationTaskPayload`、`InsightsTaskPayload` 加 `force?: boolean`。
Batch / All 两个 schema 不动。

**去重键**（`computeAITaskDedupKey`）：Summary、Translation、Insights 分支插入
`force`/`inc` 段，与 TTS 分支同形。否则一个在跑的普通任务会把随后的强制任务当重复
吞掉（`TaskQueueService.createTask` 对 Pending/Running 返回 `created: false`）。

**in-flight key 带 force**：`buildSummaryKey`/`buildInsightsKey`/`buildTranslationKey`
三处的哈希输入加入 `force: Boolean(force)`。此前三处 key 只由 `articleId`/`lang`/
内容哈希决定，与去重键（含 force 段）脱节——force 请求若撞上一个仍在跑的 plain
请求，会在 `runWithStream` 的 `set(lockKey, 'NX')` 上落败，退化为 follower，静默复用
plain leader 的增量输出，用户以为强制生效实则未生效。现在 force 与 plain 各有独立
in-flight key，互不 follow；重复的 force 请求仍收敛到同一 key（互相 follow / 合流），
不会各自重跑模型。

**结果缓存旁路**（`ai-inflight/`）：`AiInFlightOptions` 加
`bypassResultCache?: boolean`。`runWithStream` 在其为真时跳过对 `resultKey` 的读取
（不复用旧结果），并把 `del(resultKey)` 推迟到本实例确认拿到 `lockKey` 之后才执行——
若在拿锁之前就删，会在删除与拿锁之间的窗口让并发的无关 follower（不同请求，同一
key）看到 `resultKey`/`errorKey`/`lockKey` 三者皆空而误判「无结果」并抛错。未拿到锁
（本次请求退化为 follower）时不删。summary、insights、translation 三处
`runWithStream` 调用把 force 透传下去。

**翻译放弃增量**：`AiTranslationService.runTranslationGeneration` 收到 force 时不把
`existing` 传给 `translateContentStream`，整篇重译。`existing` 仍需读取，用于 upsert 的
`sourceModifiedAt` 回退与 create/update 事件判定。

摘要与精读的任务链路本就无「命中旧结果就跳过」的分支，只需 `bypassResultCache` 即可。

### 6. i18n

`apps/admin/src/i18n/resources/{zh-CN,en-US}.ts` 新增：

- `ai.generate.langsLabel` — 目标语言（逗号分隔）
- `ai.generate.langsHint` — 留空则按 AI 设置中的目标语言
- `ai.generate.langsTooMany` — 一次最多 {max} 种语言
- `ai.generate.forceLabel` — 强制重新生成
- `ai.generate.forceHint` — 忽略缓存与增量复用，整篇重新生成

现有 `ai.translation.langLabel` 保留（词条页过滤器仍在用）。

## 测试

- admin `features/ai/utils/ai.test.ts`：`parseLangInput` 覆盖全角逗号、去重保序、
  空段、大小写折叠、纯空白输入。
- core：`computeAITaskDedupKey` 的 force 位单测（Summary / Translation / Insights，
  force 与非 force 键不同）。
- core `test/src/modules/ai/ai-inflight.service.spec.ts`：`bypassResultCache: true`
  时不复用已存在的 `resultKey`；`del(resultKey)` 只在拿到 `lockKey` 之后发生；未拿到
  锁（follower）时不删。
- core `ai-summary.service.spec.ts`/`ai-insights.service.spec.ts`/
  `ai-translation.service.spec.ts`：`buildSummaryKey`/`buildInsightsKey`/
  `buildTranslationKey` 在同一 `(articleId, lang, 内容)` 下，force 与非 force 产生不同
  key，重复 force 产生相同 key。
- core `ai-translation.service.spec.ts`：force 时 `translateContentStream` 收到的
  `existing` 为空。

## 影响与风险

- 强制重新生成必然产生真实的模型调用与费用，翻译整篇重译尤甚。文案需明示。
- 一次多语言会放大单个任务的时长；翻译已有 `translationLangConcurrency` 控制并发，
  TTS 有 `MAX_LANGS_PER_TASK = 8`，摘要按语言串行。前端 8 种上限即为此设。
- force 任务与在跑的普通任务因去重键不同可在任务队列层并存，但 in-flight key 已把
  force 并入哈希，二者各走独立的 Redis 锁/流/结果键，force 不会 follow 到 plain
  leader 的增量输出，也不会互相阻塞——各自产生真实的模型调用。
