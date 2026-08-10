# AI 多语生成通用管线（summary 对齐 insights）— 设计

日期：2026-08-10
范围：`apps/core/src/modules/ai/ai-multilang/`（新增）、`ai-summary/`、`ai-insights/`、`ai-task/`、`ai-overview/`、`packages/db-schema`、`apps/admin/src/features/ai/components/article-overview/`

## 问题

insights 已实现「源语 base → 以 base 为源译出他语」：base 行 `is_translation: false`，译行携 `source_insights_id` / `source_lang` / `hash`，译文取自 base markdown 而非原文，DB 有 `UNIQUE(ref_id, lang)`。summary 则逐语各自从原文生成，无 base 概念，`ai_summaries` 无 `source_lang` / `is_translation`，`lang` 可空且无唯一约束，并发 upsert 可致重复行。

两实现平行演化已生多处不对称：

1. `runSummaryGeneration` 与 `runInsightsGeneration` 几乎逐字重复（同一组 `runWithStream` 包装 + metrics + parse throw）。
2. insights `resolveSourceLang` 读 `article.lang`，然 posts/notes 表无此列，源语恒落 `'zh'`；overview / translation 读 `meta.lang` 判源——`meta.lang='en'` 之文 insights base 恒为 zh，覆盖度永报 gap。
3. `CreateInsightsTaskSchema.targetLanguages` 无 `.max(MAX_LANGS_PER_TASK)` 与 `trim().min(1)`，8 语上限与空 token 拒收可被绕过。
4. overview active-tasks 对 insights 任务硬编码 `langs: []`，请求语在跑时显示为闲置/缺口。

本设计抽一条通用多语生成管线，insights 迁入、summary 落入，根除双实现漂移。

## 一、架构与组件

新共享层 `apps/core/src/modules/ai/ai-multilang/`：

- **`MultilangAdapter`**（接口，各 feature 实现）：
  - `feature` 键（in-flight stream key 前缀：`summary` / `insights`）
  - `basePrompt(lang, articleText)` 与 `translationPrompt(targetLang, baseContent)`
  - repo 端口：`upsertBase` / `upsertTranslation` / `findBase(refId, sourceLang)` / `deleteStaleTranslations(refId, hash)`
  - 任务类型对（base + translation）与 `*_GENERATED` 事件名
  - 结果校验（今二者 `parseResult` throw 同形）
- **`MultilangGenerationService`**（共享执行体）：源语解析 → base 生成（合并两处 `runWithStream` 包装 + metrics）→ 失效异 hash 旧译 → 他语并发译 → 发事件。
- **`resolveArticleSourceLang`**：`normalize(meta.lang) ?? DEFAULT_SUMMARY_LANG`，summary / insights / overview 三处共用，并治 insights 读 `article.lang` 之疾。
- **base 查找规则**：`is_translation = false 且 lang = 源语`，弃「最新非译行」——summary 存量行皆 `is_translation = false`，旧规则会误认他语行为 base。insights 同迁此规则。
- insights 二服务（`AiInsightsService` / `AiInsightsTranslationService`）改为 adapter + 薄壳，`enableAutoTranslateInsights` 事件驱动扇出保留不动；summary 弃逐语循环，新增 `AITaskType.SummaryTranslation`。

## 二、数据与迁移

`ai_summaries` 对齐 `ai_insights`：

- 加列：`is_translation boolean NOT NULL DEFAULT false`、`source_summary_id` 自引用 FK（`ON DELETE SET NULL`）、`source_lang text`。
- 回填：`lang IS NULL` → `'zh'`（overview 读时已如此折算，今落库）。
- 按 `(ref_id, lang)` 去重（留最新），后建 `UNIQUE(ref_id, lang)`。
- 存量他语行不强判为译，保持 `is_translation = false`——base 查找按「`lang = 源语`」故无误认之虞；后续生成自然覆写补全。
- 滚动部署：加列带默认值安全；唯一约束令旧副本手写 upsert 之竞态由静默重复转为报错，反为改善。迁移依 `mx-migration-author` skill 行文。

## 三、数据流与编排

Summary / Insights 任务同走一管线：

1. 语集解析：`payload.targetLanguages ?? config`，normalize。
2. `resolveArticleSourceLang` 定源语。
3. **base**：in-flight key `{feature, articleId, lang: 源语, textHash}`；base 已在且 hash 同且非 force → 复用免生成；成则 upsert base 行、失效异 hash 旧译、发 `SUMMARY_GENERATED` / `INSIGHTS_GENERATED`。
4. **译**：目标语减源语，pLimit 并发（`translationLangConcurrency ?? 3`），prompt 取 base 内容为源，译行携 `hash = base.hash`、`is_translation = true`、`source_*_id`、`source_lang`。
5. 失败语义：base 败 → `Failed`，译不启；译部分败 → `PartialFailed` 携 per-lang errors（同 ai-translation 例）；force 全程透传（绕 in-flight 结果缓存 + 折入 dedup key）。
6. 请求仅含他语（源 zh 只求 en）→ 仍先立/复用 base 再译。

编排变更：

- insights 任务链发队列子任务（`ai-insights.service.ts:101` 一段）删，改上述内联并发。
- `SummaryTranslation` / `InsightsTranslation` 任务类型保留，供 admin 单语补译调度；`SummaryTranslation` dedup key 同 `InsightsTranslation`：`${refId}:${targetLang}:${force ? 'force' : 'inc'}`。`Summary` / `Insights` key 不变。

外围随治：

- overview active-tasks 之 insights `langs: []` 硬编码改读 `payload.targetLanguages`。
- admin `buildGenerateTask` summary 分支对齐 insights：base 在则发单语 `SummaryTranslation`，否则 base task 携全语。
- 新 summary translation 调度 endpoint（mirror insights controller，含 `source-missing` reason）。
- `CreateInsightsTaskSchema.targetLanguages` 补 `.max(MAX_LANGS_PER_TASK)` 与 `trim().min(1)`。

## 四、测试

- 新管线单测：mock adapter 覆 base 复用、force 绕缓存、异 hash 失效旧译、并发译、部分败、事件发射。
- 既有 spec 随行为改期望：`ai-summary.service.spec`（逐语循环 → base+译）、`ai-insights.service.spec`（链发 → 内联并发）、`ai-insights-translation.service.spec`（事件路径不变）。
- `compute-ai-task-dedup-key.spec` 增 `SummaryTranslation`；`ai-task.dto.spec` 增 insights cap；`ai-overview-active-tasks.util.spec` 改 insights langs 期望。
- 迁移过 `lint:migrations`；admin `overview-generate-task` summary 分支若有测试基建则补。

## 不做

- ai-tts 不入管线。
- 不新增 `enableAutoTranslateSummaries` 配置——base 任务内联扇出已覆盖显式请求，自动生成路径沿用 `summaryTargetLanguages`。
- 不回填存量他语 summary 行的 `is_translation` / `source_summary_id`（无法在 SQL 内可靠解析各文源语），待自然覆写。
