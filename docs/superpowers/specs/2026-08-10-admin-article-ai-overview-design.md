# 单文章 AI 汇总看板 — 设计

日期：2026-08-10
范围：`apps/core/src/modules/ai/ai-overview/`（新增）、`apps/admin/src/features/ai/components/article-overview/`（新增）

## 问题

admin 的 AI 数据按能力横切成四条路由——`/ai/summary`、`/ai/insights`、`/ai/translation`、`/ai/tts`——每条皆是「文章分组 → 选中文章 → 该能力的条目」。缺的是反向视角：给定一篇文章，它的 AI 资产是否齐备、共花了多少钱、用了哪些模型，无处可查。现存的 per-article 入口只有 PostRow / NoteRow 右键菜单里的四个生成动作，纯写无读。

本设计新增一个以文章为单位的汇总看板，同时服务三个目的：

1. **覆盖度管理** — 一眼看出这篇文章缺哪些语言的哪些资产，并就地补生成。
2. **成本与用量审计** — 这篇文章累计花了多少 token、多少美元，按能力拆分。
3. **内容速览** — 四类资产聚于一页可读可听。

不做：生成时间线、按缺口/成本排序、看板内内联编辑（编辑跳回现有四条路由）。

## 路由

`apps/admin/src/views/(intelligence)/ai/page.tsx` 目前直接 `re-export AiSummaryRouteView`，与 `views/(intelligence)/ai/summary/page.tsx` 完全重复——侧栏两个入口指向同一视图。看板接管 `/ai`：

- `views/(intelligence)/ai/page.tsx` → 改为 export `AiOverviewRouteView`，`titleKey` 改 `routes.aiOverview.*`，图标保留 `Sparkles`
- `views/(intelligence)/ai/summary/page.tsx` → 原样不动

零新增路由文件，顺带消除既有的重复入口。

## 后端

新目录 `apps/core/src/modules/ai/ai-overview/`：`ai-overview.controller.ts`、`ai-overview.service.ts`、`ai-overview.views.ts`、`ai-overview.types.ts`，在 `ai.module.ts` 的 `controllers` / `providers` 注册。

两个端点，皆 `@Auth()`：

```
GET /ai/overview/grouped?page&size&search
GET /ai/overview/article/:id
```

### 文章全集与适用性

文章全集取 `DatabaseService.findAllArticlesForTranslation()`，即 posts + notes + pages。四能力的适用范围并不一致——translation 用的是这一全集，而 summary / insights / tts 用的是 `findAllArticlesForAIText()`（posts + notes，无 pages）。故 page 类型的行在 summary / insights / tts 三列标 `applicable: false`，呈灰，不计入缺口。

分页**不走** `buildGroupedWithOrphans`。该 util 的排序语义是「有记录者先、孤儿后」，与本看板要求的「全部文章时间倒序」相悖。overview 直接对文章全集按 id 降序（Snowflake 单调递增，≈ 创建时间倒序）切片，再对本页 refIds 发四条窄查询：

```sql
SELECT ref_id, lang [, source_lang] FROM <ai_table> WHERE ref_id IN (...)
```

每页 20 篇 → 四条窄索引查询，只取判定覆盖所需的两三列。

`search` 沿用 `DatabaseService.findArticleIdsByTitle(search)` 先缩 refId 集合，再切片。

### 期望语言集

| 能力 | 期望集来源 |
|---|---|
| summary | 配置 `ai.summaryTargetLanguages` |
| insights | 配置 `ai.insightsTargetLanguages` |
| translation | 配置 `ai.translationTargetLanguages` |
| tts | 原文语 ∪ 该文已有译文语 |

TTS 无配置项，且它依附于实际存在的文本——未译之语本就无法朗读，不应计为缺口。原文语取 `getMetaLang(document)`，缺则退而取该文任一 translation 记录的 `sourceLang`；二者皆无时期望集退化为「已有译文语」。

translation 的期望集须再剔除原文语——原文无需译回自身。该列在矩阵中标为「源」，属不适用态。

前三项的期望集全页恒定，提至响应 `meta`，不逐行重复；tts 的期望集逐行自算，写在行内。

### 列表响应

```ts
// data[]
{
  article: RefArticleInfo,
  coverage: {
    summary:     { langs: string[]; applicable: boolean }
    insights:    { langs: string[]; applicable: boolean }
    translation: { langs: string[]; sourceLang: string | null; applicable: true }
    tts:         { langs: string[]; expected: string[]; applicable: boolean }
  },
  gapCount: number
}

// meta（withMeta）
{
  pagination: PaginationInfo,
  expectedLanguages: { summary: string[]; insights: string[]; translation: string[] }
}
```

`gapCount` = Σ 各适用能力的 `expected \ langs` 之基数。

### 详情响应

```ts
{
  article: RefArticleInfo,
  coverage: /* 同上，单篇 */,
  assets: {
    summary:     Array<{ id, lang, summary, createdAt, updatedAt, generationMetrics }>
    insights:    Array<{ id, lang, content, createdAt, updatedAt, generationMetrics }>
    translation: Array<{ id, lang, sourceLang, createdAt, updatedAt, generationMetrics }>
    tts:         Array<{ id, lang, duration, url, createdAt, generationMetrics }>
  },
  cost: {
    total: CostBucket,
    byResourceType: Record<'summary'|'insights'|'translation'|'tts', CostBucket>,
    models: string[]
  }
}

type CostBucket = {
  inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
  totalTokens, costTotalUsd, generationCount
}
```

译文的 `content` 是整篇 Lexical JSON，体积可观。看板既不内联编辑，就不传——只留 id / lang / sourceLang / 时间 / metrics，编辑由跳转到 `/ai/translation/:refId` 承担。summary 短、insights 中等，皆带全文以支撑「内容速览」。

`generationMetrics` 沿用现有 `AiGenerationMetricsService.attachLatest`，即每条资产**最新一次**生成的用量。

### 成本聚合

新增 `AiGenerationMetricsRepository.sumByRef(refId)`——按 `resource_type` 分组，对 `input_tokens` / `output_tokens` / `cache_read_tokens` / `cache_write_tokens` / `total_tokens` / `cost_total_usd` 求和，并 `count(*)` 得 `generationCount`，另以 `distinct model` 得模型列表。

语义须写明：它累计的是**现存资产的全部生成记录**。同一 `resourceId` 重生成会多插一行，故求和即真实累计花费，非「最后一次」。反之 `deleteByResource` 会连带清除 metrics 行——删掉的资产不再计入历史成本。此为既有行为，本设计不改。

该查询所需的索引已存在——`packages/db-schema/src/schema/ai.ts` 中的 `ai_generation_metrics_ref_id_idx` 建于 `(ref_id, created_at)`。本功能不需要任何 migration。

## 前端

### 组件树

```
features/ai/routes/AiOverviewRouteView.tsx      薄壳，与同目录四兄弟同构
features/ai/components/article-overview/
  ArticleOverviewRouteView.tsx   MasterDetailShell + useInfiniteQuery + 搜索防抖
  OverviewListRow.tsx            类型图标 + 标题 + 四能力点阵 + 缺口数
  OverviewDetailPane.tsx         useQuery(detail)，三段编排，持 highlightKey
  CoverageMatrix.tsx             能力 × 语言，onCellClick(capability, lang, state)
  CostSummarySection.tsx         总计 + byResourceType + models
  AssetSection.tsx               资产行，按 `${capability}:${lang}` 注册 ref
  useOverviewActions.ts          生成 / 重生成 / 删除 + 缓存失效
api/ai-overview.ts               两个 fetcher
```

沿用现有 `MasterDetailShell` / `AppPage` 布局约定，与四条旧路由同构。类型图标与编辑路径复用 `refTypeMeta.ts` 的 `getRefTypeMeta`。

### 详情版式

自上而下三段：**覆盖矩阵 → 成本 → 资产列表**。

矩阵为行=能力（4）、列=语言（期望集与已有集之并，去重排序）的网格。格三态：

- **已有** — 实心，点击 → 滚动定位并高亮下方资产列表中的对应行
- **缺口** — 虚线，点击 → 直接派该 capability + lang 的生成任务
- **不适用** — 淡灰，不可点（page 的 summary / insights / tts；translation 的原文语列标「源」）

矩阵只作索引，不就地展开内容——内容单处呈现于资产列表，无重复渲染，矩阵行位亦不因展开而位移。

锚定实现：格点击回传 `capability:lang`，`OverviewDetailPane` 置 `highlightKey`，`AssetSection` 中该行 `scrollIntoView({ block: 'nearest' })` 并高亮约 1.2s 后自清。同一语言存在多条（TTS 常留旧版）时锚定最新一条。

左列行以点阵表达覆盖：四能力各占一点，齐 / 部分 / 无三态配色，行尾附缺口数。列表全量含零资产文章——只有全量才看得见从未生成过的漏网之鱼。

### 动作

自 `use-ai-quick-actions.ts` 抽出 mutation 内核为 `useAiGenerateTask(refId)`，与 PostRow / NoteRow 右键菜单共用。菜单侧仍以 `presentGeneratePrompt` 询问语言；看板侧不问——矩阵格已确定 capability 与 lang。

删除走现有 `deleteSummary` / `deleteInsights` / `deleteTranslation` / `deleteTts`，带确认。重生成即以同 capability + lang 再派一次任务。

### 缓存失效

生成 / 删除成功后失效 `ai.overview.article(id)`、`ai.overview.listRoot`（缺口数会变）、`tasks.tasksRoot`。

另接 socket：`SocketBridge` 已处理 `TASK_UPDATE`。当 `scope === 'ai'` 且状态转入终态（`completed` / `partial_failed` / `failed`）时，比对 `payload.refId` 与当前打开的文章，命中则失效详情。任务完成即自动刷新，无需手动。

### 错误与空态

- 详情请求失败 → `EmptyState` 加重试按钮
- 文章零资产 → 矩阵满格虚线、成本段整块隐藏、资产段 `EmptyState`
- 列表沿用现有 infinite query 的加载 / 空 / 错误处理

## 测试

**后端单测**（`ai-overview.service.spec.ts`）
- 覆盖度计算：配置目标语 vs 已有语，缺口集正确
- TTS 期望集推导：原文语来自 meta、来自 translation.sourceLang、二者皆缺三条路径
- page 行的 summary / insights / tts 标 `applicable: false` 且不计缺口
- `sumByRef` 分组聚合：同一 resourceId 多条记录求和，非取最新

**后端 faux e2e**（`ai-overview.faux.e2e.spec.ts`）
- 两端点的响应形状、`withMeta` 信封、snake_case 出线
- 列表分页与 search 过滤

**前端单测**
- `CoverageMatrix`：三态映射与点击回传
- `useOverviewActions`：失效键集正确

## 影响面

- 新增：一个后端模块目录、一个前端组件目录、一个 metrics 仓库方法、一条索引 migration（若需）
- 修改：`views/(intelligence)/ai/page.tsx` 的 export 与 metadata；`use-ai-quick-actions.ts` 抽出 hook；`ai.module.ts` 注册；i18n 新增 `routes.aiOverview.*` 与 `ai.overview.*` 词条
- 不动：四条旧 AI 路由、四个 feature service 的既有端点、metrics 记录写入路径
