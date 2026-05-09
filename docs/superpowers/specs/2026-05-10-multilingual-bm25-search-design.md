# 多语言 BM25 全文搜索设计

- 日期：2026-05-10
- 范围：
  - 后端：`apps/core/src/modules/search/*`、`packages/db-schema/src/schema/ai.ts`（`searchDocuments`）、`apps/core/src/modules/ai/ai-translation/*`、`apps/core/src/constants/business-event.constant.ts`、`apps/core/src/modules/cron-task/*`（rebuild 调用点）
  - SDK：`packages/api-client/controllers/search.ts`
  - 前端：`Yohaku/apps/web/src/app/[locale]/search/SearchPageClient.tsx`、`Yohaku/apps/web/src/components/modules/shared/SearchFAB.tsx`
  - Admin：`admin-vue3`（重建按钮 + 索引验证页）
- 关联：`docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md`（迁移走 expand-contract）

## 背景

现有 BM25 倒排索引由 `search.service.ts` 维护，仅索引 post/note/page **原文**。`ai_translations` 表已为同一篇文存有 zh/en/ja 等翻译版本（含 `title`、`text`、`subtitle`、`summary`、`tags`），但搜索不感知翻译，造成：

1. 用户在 `lang=ja` 上下文中搜索时，仅命中原文 token，召回低
2. 中日韩 unigram/bigram tokenizer 跨语料混算 IDF/avgDocLen，BM25 标度失真
3. 翻译生成/更新/删除事件未驱动索引刷新

UX 决议：**按语言隔离搜索**——主查所选 lang 之索引；该 lang 缺译时回退原文索引并以折扣合并。

## 目标与非目标

### 目标
- `search_documents` 支持每篇文 N+1 个语言版本（原文 + N 翻译）
- BM25 corpus stats（totalDocs、avgTitleLength、avgBodyLength、IDF）按 lang 分组聚合
- 翻译 lifecycle（create/update/delete）驱动索引同步
- 检索 API 接受 lang 参数（缺省取 `RequestContext.currentLang()`），主查命中 + 回退原文（折扣 0.6）合并去重
- 高亮 snippet 取所选语言版本之 `searchText`
- 迁移按 expand-contract，不阻塞滚动部署

### 非目标
- 不引入 PostgreSQL `tsvector`/`websearch_to_tsquery`（保持纯 JS BM25 路径，与现状一致）
- 不为不同 lang 切换 tokenizer 实现（CJK 通用分支已可处理 zh/ja/ko；西文 word 分支处理罗马字）
- 不实现机器学习 reranker；折扣系数为固定常量
- 不改 `translation_entries`（i18n 字典型翻译，与文章长文本搜索无关）

## 架构

```
┌──────────────────────┐        ┌──────────────────────────┐
│ Post/Note/Page Event │        │  AiTranslation Event     │
│  (CREATE/UPDATE/     │        │  (TRANSLATION_CREATE/    │
│   DELETE)            │        │   _UPDATE/_DELETE)       │
└──────────┬───────────┘        └────────────┬─────────────┘
           │                                 │
           │  upsertSourceDocument()         │  upsertTranslationDocument()
           │   (lang = source_lang)          │   (lang = translation.lang)
           ▼                                 ▼
       ┌────────────────────────────────────────────┐
       │  SearchService                             │
       │  ── per-lang corpus stats cache             │
       │  ── BM25 ranking with lang scope            │
       └────────────────────┬───────────────────────┘
                            │
                            ▼
       ┌────────────────────────────────────────────┐
       │  search_documents                          │
       │  PK: id                                    │
       │  UNIQUE (ref_type, ref_id, lang)           │
       │  + lang TEXT NOT NULL                      │
       └────────────────────────────────────────────┘
```

## Schema 改造（`packages/db-schema/src/schema/ai.ts`）

```ts
export const searchDocuments = pgTable(
  'search_documents',
  {
    id: pkText(),
    refType: text('ref_type').notNull(),
    refId: refText('ref_id').notNull(),
    lang: text('lang').notNull(),                   // ← 新增
    title: text('title').notNull(),
    searchText: text('search_text').notNull(),
    terms: text('terms').array().notNull().default(sql`'{}'::text[]`),
    titleTermFreq: jsonb('title_term_freq').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    bodyTermFreq: jsonb('body_term_freq').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    titleLength: integer('title_length').notNull().default(0),
    bodyLength: integer('body_length').notNull().default(0),
    slug: text('slug'),
    nid: integer('nid'),
    isPublished: boolean('is_published').notNull().default(true),
    publicAt: tsCol('public_at'),
    hasPassword: boolean('has_password').notNull().default(false),
    createdAt: createdAt(),
    modifiedAt: tsCol('modified_at'),
  },
  (table) => [
    uniqueIndex('search_documents_ref_lang_uniq').on(
      table.refType, table.refId, table.lang,
    ),                                              // ← 替换原 (refType, refId) 唯一
    index('search_documents_published_idx').on(table.isPublished, table.publicAt),
    index('search_documents_lang_idx').on(table.lang),  // ← 新增，per-lang 聚合查询
  ],
)
```

### 迁移序列（expand-contract）

旧 unique index `search_documents_ref_uniq` 阻止同 (refType, refId) 多行；故必须 expand 阶段先删旧 index 再加 lang 列与新 unique。但 lang 默认值不可缺：现存全部行为原文，回填 `'zh'`（默认 source_lang）。生产可通过 admin 工具按 article 实际 source_lang 修正。

**Phase 1 (expand, 与旧代码兼容)：**
```sql
ALTER TABLE search_documents ADD COLUMN lang text NOT NULL DEFAULT 'zh';
ALTER TABLE search_documents ALTER COLUMN lang DROP DEFAULT;
DROP INDEX IF EXISTS search_documents_ref_uniq;
CREATE UNIQUE INDEX CONCURRENTLY search_documents_ref_lang_uniq
  ON search_documents (ref_type, ref_id, lang);
CREATE INDEX CONCURRENTLY search_documents_lang_idx
  ON search_documents (lang);
```

旧版 `SearchRepository.upsert` 仍按 (refType, refId) 查找，会命中 lang='zh' 一行——行为兼容。

**Phase 2 (contract, 新代码上线后)：** 无需。新 unique 已是终态。

风险：列 `NOT NULL DEFAULT` 在大表上可能锁表。当前 `search_documents` 行数 ≈ 文章数（百量级），可接受。仍按 `mx-migration-author` skill 校验。

## SearchDocument 模型与构建

### 类型扩展
`SearchDocumentRow` 与 `SearchDocumentUpsertInput` 加 `lang: string`。

### `buildSearchDocument` 改造（`search-document.util.ts`）
新增参数 `lang: string`，写入返回结构。其余 tokenize/normalize 逻辑不变（现 CJK 分支已通用于 zh/ja/ko，西文分支处理罗马字、英文翻译）。

### 触发路径

#### 原文（既有）
`onPostCreate/Update`、`onNoteCreate/Update`、`onPageCreate/Update`：
- 取 article 的 `source_lang`：先查 `aiTranslationRepository.findOneByRefId(refId)` 之任一行（`sourceLang` 字段），缺则回退 `article.meta?.lang`，再缺回退环境配置 `defaultSourceLang`（默认 `'zh'`）
- 调 `upsertSearchDocument(refType, id, sourceLang)`
- 缓存 source_lang 至内存 LRU（key=refId），避免每次更新都查 ai_translations

`onPostDelete/NoteDelete/PageDelete`：删该 ref 下**所有 lang** 行（`searchRepository.deleteByRef(refType, id)` 不带 lang）。

#### 翻译（新增）
新增事件 `BusinessEvents.TRANSLATION_DELETE`。`AiTranslationService.deleteTranslationsByRefId` / 按 lang 删 / 等地方 emit。

`SearchService` 加：
- `@OnEvent(TRANSLATION_CREATE)` / `@OnEvent(TRANSLATION_UPDATE)` → `upsertTranslationSearchDocument(translation)`
  - 内部用 `aiTranslations` 行的 `refType`/`refId`/`lang`/`title`/`text`/`subtitle`/`summary`/`tags`/`contentFormat`/`content`，复用 `buildSearchDocument(refType, { ...translation, slug, nid, isPublished, publicAt, hasPassword }, lang)`
  - slug/nid/isPublished/publicAt/hasPassword 从对应原文 article 取（cached fetch）
- `@OnEvent(TRANSLATION_DELETE)` → `searchRepository.deleteByRef(refType, refId, lang)`

#### `rebuildSearchDocuments`
`SearchService.rebuildSearchDocuments` 扩展：枚举所有 article 后，再枚举 `aiTranslations` 全表（按 (refType, refId) 分组），为每翻译写一行。

## Repository 改造

### 增 lang 维度

`SearchRepository`：
- `findByRef(refType, refId)` → `findByRef(refType, refId, lang)`，仍返回单行
- `deleteByRef(refType, refId, lang?)`：缺省 lang 时删该 ref 全部 lang
- `findByTerms(terms, refType, lang, limit)`：增 lang 过滤；缺省 undefined 表示不过滤（rebuild/统计场景）
- `findByKeyword(keyword, refType, lang, limit)`：同上
- `listVisible(refType, page, size, lang?)`：同上
- `findAll(refType, lang?)`：同上
- `upsert(input)`：入参含 `lang`，按 (refType, refId, lang) 唯一找 existing，update 或 insert

### `findCorpusStatsByLang`（新）

替代原 `getCorpusStats` 中 `findAll` 全表扫的方式（旧路径仍每次全量算 stats，已是性能 hot spot）：

```ts
async findCorpusStatsByLang(
  lang: string,
  refType: SearchDocumentRefType | undefined,
  visibilityFilters: SQL[],
): Promise<{ totalDocs: number; avgTitleLength: number; avgBodyLength: number }> {
  // SELECT count(*), avg(title_length), avg(body_length)
  //   FROM search_documents
  //   WHERE lang = $1 [AND ref_type = $2] AND <visibility>
}
```

聚合在 DB 层做，返回单行三列。无需把全部行抽到 Node。

## 检索流程（`SearchService.searchIndex`）

### 入参
`SearchDto` 新增可选 `lang?: string`。

### 决议 effectiveLang
```
effectiveLang =
  searchOption.lang
  ?? RequestContext.currentLang()
  ?? configService.get('translation').defaultLang
  ?? 'zh'
```

### 主查 + 回退合并

```
1. mainHits = searchInLang(effectiveLang, searchTerms, refType, ...)
2. for each ref in mainHits: collect (refType, refId)
3. fallbackHits = searchInLang(<source_lang_for_each_ref_not_in_mainHits>, ...)
   实际实现：fallbackHits 走 source_lang 检索一次（原文 lang 同一），但只保留主查未召回之 (refType, refId)
4. 折扣：fallbackHits 每条 score *= SEARCH_FALLBACK_DISCOUNT (0.6)
5. merged = mainHits ∪ fallbackHits（按 (refType, refId) 去重，主查优先）
6. 排序、分页、去重照旧
```

`searchInLang` = 现 `searchByTerms` + `searchByText` + `searchByRegex` + `getCorpusStats` + `getTermDocumentFrequency` 之合一封装，所有内部查询带 lang 过滤；BM25 stats 与 df 仅在该 lang 子语料中算，IDF 标度纯净。

### 折扣常量
`search.constants.ts` 加 `SEARCH_FALLBACK_DISCOUNT = 0.6`。可后续配置化，初版固定。

### 高亮 snippet
取**命中文档自身**之 `searchText`（其 lang）。即主查命中 → snippet 用翻译版文本；回退命中 → snippet 用原文。已天然成立，无需改 `buildSearchHighlight`。

### 返回结构
`Pagination<SearchHit>`，每条 hit 加：
- `lang: string`：实际命中索引之 lang
- `isFallback: boolean`：是否回退原文得来
- `title: string`：**覆盖**为命中文档之 title（即所选 lang 翻译版 title；fallback 时为原文 title）
- `highlight.snippet`：天然取自命中文档 searchText（翻译版或原文）

`loadSearchResultData` 拼装步骤：
1. 按 (refType, refId) 批量取原文 article 数据（用作 url/category/slug/nid 等结构字段）
2. 对每条 hit：
   - 用 hit 自身的 `title` 覆盖 article 之 title
   - 不覆盖 article 其他字段（category/slug 等结构信息仍来自原文）
   - 附加 `highlight.snippet`（已含翻译版 snippet）、`lang`、`isFallback`
3. 不再额外调 `translateArticle`——hit 自带翻译版数据，避免二次查询

## API 形状

### `SearchDto`
```ts
{
  keyword: string
  page: number
  size: number
  lang?: string   // 新增，可选
}
```

无 lang 时由 `RequestContext.currentLang()` 决议；管理端调试时显式传。

### Endpoints
路径不变。Response 结构追加 `lang`、`isFallback` 字段；`title` 字段语义改为「显示用 title（按 lang 解析后）」，旧客户端无察觉地享受翻译版。

## SDK 改造（`packages/api-client/controllers/search.ts`）

```ts
export type SearchOption = {
  orderBy?: string
  order?: number
  lang?: string                    // ← 新增；缺省由调用层中间件注入
}

export type SearchResultMeta = {
  lang: string
  isFallback: boolean
}

// search(type, ...) 与 searchAll(...) 的 PaginateResult 元素类型
// 在原 SearchResultHighlight 基础上 & SearchResultMeta
```

API 客户端无逻辑变化，仅类型扩展。版本按现有发布流程 bump。

## Yohaku 前端接入（`Yohaku/apps/web`）

### 现状梳理
- `providers/root/lang-sync-provider.tsx`：`useLocale()` → `attachFetchHeader('x-lang', locale)`
- `lib/fetch/fetch.client.ts` `onRequest`：`globalConfigureHeader['x-lang']` 存在时自动 `query.lang = lang`
- `lib/fetch/fetch.server.ts` `runWithLang(locale, fn)`：服务端等效 `searchParams.lang`
- 故所有现有 `apiClient.*` 调用**已自动携带 lang**，无需在调用点传参

### 改造点

#### 1. `SearchPageClient.tsx`（client component）
- `useQuery` queryKey 加 `locale`：从 `useLocale()` 取，作为缓存键之一，否则 locale 切换不会触发重查
  ```ts
  const locale = useLocale()
  useQuery({
    queryKey: ['search', debouncedKeyword, locale],
    queryFn: () => apiClient.search.searchAll(debouncedKeyword),
    enabled: !!debouncedKeyword,
    select: ...
  })
  ```
- `select` 里：
  - `item.title` 直接来自 search response（已是显示用 lang 之 title）
  - `item.highlight.snippet` 已是翻译版片段
  - 可选 UI：当 `item.isFallback === true`（如新增字段从 response 直读）显示一行 small 文字「以原文匹配」（i18n key 新增 `search_fallback_to_source`）
- `SearchListType` 增 `isFallback?: boolean`，`SearchItem` 接收并渲染徽标

#### 2. `SearchFAB.tsx`
快速搜索浮窗。同 `SearchPageClient` 改造（queryKey 加 locale；可选 fallback 徽标）。

#### 3. i18n 文案
新增以下 key（参照仓内 `messages/{en,zh,ja}.json` 结构）：
- `common.search_fallback_to_source`：英 `Matched in original`、中 `以原文匹配`、日 `原文一致`

### 不需改动
- `lib/fetch/*`：lang 注入路径已通；ofetch 的 `onRequest` 自动追加 `?lang=`
- `LangSyncProvider`：保持不变
- 服务端首屏：现 `SearchPageClient` 完全 client，初次渲染由 `useQuery` 触发，已含 x-lang 注入

### 兼容性
- 旧 mx-core 后端（未上线 lang）忽略 `?lang=` 参数，仍按原流程返回——前端表现与今日一致
- 旧前端（未升级）调新后端：lang 缺省走 `RequestContext.currentLang()` 回退至 default，行为退化为单语言搜索，无破坏

### 灰度策略
- mx-core 先发版（schema migration + service 改造），上线后所有 `/api/v?/search` 即支持 lang，无 lang 时不变
- api-client bump 后 Yohaku 升级依赖
- Yohaku 改造可单独发布；queryKey 修复优先于 isFallback 徽标

## Corpus stats 缓存

per-lang stats（totalDocs/avgTitleLength/avgBodyLength）每次查询都跑一次 `count + avg` 仍开销小（单语言数百~数千行），首版无缓存。若后续慢，加 Redis key `search:stats:{refType}:{lang}`，TTL 60s，invalidate-on-upsert。本设计先不实现，仅留扩展点（service 内方法可包 `getCachedCorpusStats`）。

## 错误处理与一致性

- 翻译先于原文事件到达：上游事件由 nest 顺序投递，理论不会；防御性地，`upsertTranslationSearchDocument` 找不到原文时跳过并 warn log
- 原文删除但翻译残留：`POST_DELETE` 等已 cascade 删 `ai_translations`（见 `ai-translation-event-handler.service.ts`）；search 端额外执行 `deleteByRef(refType, refId)` 去全 lang，幂等
- 翻译并发更新：`searchRepository.upsert` 走 `select-then-insert/update`，并发下可能 unique violation；现状未做 ON CONFLICT，本次同步改 `INSERT … ON CONFLICT (ref_type, ref_id, lang) DO UPDATE`
- rebuild 期间事件竞争：`rebuildSearchDocuments` 先 `deleteAll` 再批量 upsert；与 OnEvent 处理共享同一 repository，无显式锁。建议 rebuild 端短窗口接受少量丢失（与现状一致），不引入分布式锁

## 测试

- 单元（`search-document.util.spec.ts`）
  - `buildSearchDocument` 接受 lang，返回字段含 lang
  - tokenizer 对 zh/en/ja 各自能产生合理 terms
- 仓储（`search.repository.spec.ts`，pg-testcontainer）
  - upsert 同 (refType, refId) 不同 lang 互不覆盖
  - `deleteByRef` 不带 lang 删全部；带 lang 仅删该 lang
  - `findCorpusStatsByLang` 聚合正确
- 服务（`search.service.spec.ts`）
  - 主查命中：仅返回 effectiveLang 行
  - 主查未召回：回退 source_lang，分数 ×0.6，flag `isFallback`
  - 翻译 create/update/delete 事件正确驱动 upsert/delete
  - rebuild：枚举 article + ai_translations 全集
- e2e（`search.e2e.spec.ts`）
  - `GET /search?keyword=...&lang=en` 在仅原文为 zh 的语料下回退命中
  - `GET /search?keyword=...&lang=zh` 命中翻译为 zh 的英文原文章
- 迁移
  - `lint:migrations` 通过
  - 现存行回填 lang='zh' 后 unique index 不冲突

## 实施顺序（草拟，正式由 writing-plans 出）

### mx-core
1. schema：加 lang 列、source_hash 列、新 unique、drop 旧 unique（迁移文件）
2. types：`SearchDocumentRow/Model/UpsertInput` 加 lang 与 sourceHash
3. `search-document.util.ts`：`buildSearchDocument` 接受 lang；新增 `computeSourceHash`
4. `search.repository.ts`：所有 query/upsert/delete 带 lang；新 `findCorpusStatsByLang`、`findAllAdminRows`（分页）、`findHashesByRef`；`upsert` 切 `INSERT ... ON CONFLICT`
5. `business-event.constant.ts`：加 `TRANSLATION_DELETE`；`ai-translation.service.ts` 删除路径 emit
6. `search.service.ts`：source_lang 决议、`upsertTranslationSearchDocument`、监听 TRANSLATION_*、`searchInLang` 重构、回退合并、hit-side title/snippet 注入
7. `search.service.ts`：`rebuildSearchDocuments({ force })` 增量路径、`rebuildSingleRef`；移除 `findRecent(100)` 上限改分页迭代
8. `search.controller.ts` + `search.schema.ts`：DTO 加 lang；`POST /search/rebuild?force=`、`POST /search/rebuild/:refType/:refId`、`GET /search/admin/documents`
9. `cron-business.service.ts`：cron 调用改为 `force: false`
10. 测试：单元 + e2e（含增量 diff 各分支）

### api-client（mx-core 仓内 packages/api-client）
11. `controllers/search.ts`：`SearchOption.lang`、response 类型加 `lang`、`isFallback`；新增 `rebuild({ force })`、`rebuildOne(refType, refId)`、`adminListDocuments(query)` 方法
12. 发布新版本（按 release-core 流程）

### Yohaku
13. 升级 `@mx-space/api-client` 至新版
14. `SearchPageClient.tsx`、`SearchFAB.tsx`：queryKey 加 locale；显示 isFallback 徽标
15. i18n 文案新增 `search_fallback_to_source`
16. 验证：lang 切换触发重查，搜索结果展示翻译版 title/snippet

### admin-vue3
17. 系统设置页：加「重建搜索索引」按钮 + 「强制全量」复选框，调 `apiClient.search.rebuild({ force })`，吐出 created/updated/deleted/skipped 统计
18. 新页面 `/dashboard/search-index`：调 `apiClient.search.adminListDocuments(...)`，含过滤、单条重建、统计区
19. 菜单加入口

### api-client（mx-core 仓内 packages/api-client）
9. `controllers/search.ts`：`SearchOption.lang`、response 类型加 `lang`、`isFallback`
10. 发布新版本（按 release-core 流程）

### Yohaku
11. 升级 `@mx-space/api-client` 至新版
12. `SearchPageClient.tsx`、`SearchFAB.tsx`：queryKey 加 locale；显示 isFallback 徽标
13. i18n 文案新增 `search_fallback_to_source`
14. 验证：lang 切换触发重查，搜索结果展示翻译版 title/snippet

## Rebuild 增量化与 Admin 接入

### 现状问题
1. `cron-task.scheduler.ts` 每日 4 AM 全量 rebuild：先 `deleteAll` 再全表 upsert，无差量判断
2. `searchService.buildSearchDocuments` 内 `findRecent(100)` —— **仅最近 100 条入索引，老文丢失**（潜在 bug，需修）
3. 无 admin UI 入口；无索引验证视图

### 设计要点

#### Schema 加 source_hash

`search_documents` 增 `source_hash text not null default ''`：
- 原文行：`sha1(title || '\n' || text || '\n' || (content || '') || '\n' || (tags||[]).join(','))`
- 翻译行：直接取 `ai_translations.hash`（既存字段，已是源快照哈希）

迁移随主迁移 expand-contract，回填空串后让 rebuild 自然校正。

#### `rebuildSearchDocuments(options)` 重构

```ts
async rebuildSearchDocuments(options: { force?: boolean } = {})
  : Promise<{ total: number; created: number; updated: number; deleted: number; skipped: number }>
```

**force=true**：保留旧 deleteAll + 全量 upsert 路径，作"核选项"。

**force=false（默认）增量路径**：
1. 枚举 sources：
   - `postService.findAll()`、`noteService.findAll()`、`pageService.findAll()`（**去掉 100 上限**；分页迭代避免 OOM）
   - `aiTranslationRepository.findAll()`
2. 算 expected set：每条 source 产 `(refType, refId, lang) → expectedHash`
3. 一次性查 search_documents 现有 (refType, refId, lang, sourceHash)
4. diff：
   - source 有，index 无 → **insert**
   - source 有，index 有但 hash 不同 → **update**
   - source 无，index 有 → **delete**
   - source 有，index 有且 hash 同 → **skip**（计数）
5. log skipped/created/updated/deleted；rebuild 期间事件路径仍直走 upsert（不阻塞）

#### `findRecent(100)` 修正
`buildSearchDocuments` 改用 article repository 之分页 stream/cursor 接口（每批 200，无总量上限）。如各 service 暂无 stream，则在 search.service 内部分页轮询。

#### Cron 行为
`cron-business.service.ts` `rebuildSearchIndex` 每日 4AM 仍调用，但 `force=false`。变动小则几乎全 skip，开销低；force 全量保留人工触发。

#### API 扩展

```
POST /search/rebuild?force=true|false   @Auth
GET  /search/admin/documents            @Auth
       ?refType=post|note|page&lang=&page=1&size=20&keyword=
       → Pagination<SearchDocumentAdminRow>
```

`SearchDocumentAdminRow` 字段：
- `id`、`refType`、`refId`、`lang`
- `title`、`titleLength`、`bodyLength`
- `sourceHash`、`isPublished`、`publicAt`、`hasPassword`
- `modifiedAt`、`createdAt`
- `inSync: boolean`：与当前 source hash 比对结果（懒查 source；可分页内现算）
- `availableLangs: string[]`：同 (refType, refId) 已索引的 lang 列表（聚合算）

```
POST /search/rebuild/:refType/:refId    @Auth
       → 单条 ref（含其全部 lang 翻译）触发 upsert，回 { rebuilt: number }
```

### Admin (admin-vue3) 接入

#### 1. 重建按钮入口
设置/系统设置页加：
- 「重建搜索索引」按钮 → `POST /search/rebuild`
- 「强制全量重建」复选框 → `?force=true`
- 显示返回统计 `created/updated/deleted/skipped`，toast 通知

#### 2. 索引验证页（新页面）
路径建议 `/dashboard/search-index`，菜单项「搜索索引」。
- 表格列：refType / refId / lang / title / sourceHash 短哈希 / inSync / modifiedAt
- 顶部过滤：refType 多选、lang 多选、关键词
- 每行操作：
  - 「查看原文」→ 跳对应 article 编辑页
  - 「单条重建」→ `POST /search/rebuild/:refType/:refId`
- 顶部统计区：总文档数、按 refType 分布、按 lang 分布、unsync 数

具体 UI 由 admin-vue3 组件库决定（与现有 dashboard 一致即可）。本 spec 不锁死视觉。

### 兼容性
- `force=false` 是增量路径；首次上线时 sourceHash 全为空，diff 必失败 → 全部走 update。等价于一次冷启动全量。后续每日 4AM 真增量。
- 旧 admin 不携 `force` 参数 → 默认增量，安全
- 单条 rebuild 是新接口，旧 admin 无影响

## YAGNI 边界

不做：
- 不引入 OpenSearch/Elastic
- 不为每语言维护独立 PG schema
- 不做查询拼写纠错
- 不实现混合排序（lang 隔离 + 跨语言并集为本次明确未选择路径）
- 不为 i18n `translation_entries` 建索引（与文章长文本搜索域不同）
