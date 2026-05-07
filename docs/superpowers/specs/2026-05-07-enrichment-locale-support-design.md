# Enrichment Multi-Locale Support — Design

**Date**: 2026-05-07
**Scope**: `apps/core/src/modules/enrichment/`, `packages/db-schema/src/schema/enrichment.ts`

## Background

`EnrichmentService` 现以 `(provider, external_id)` 为唯一键缓存外部资源
normalize 后之结果。诸 provider 中，TMDB 之 movie/tv API 可按
`?language=zh-CN|ja-JP|ko-KR|en-US` 返本地化 title/overview/genres，然现实现
不传 `language`，故仅得默认（英）。bangumi、neodb 等 provider 单次拉取即得
源语言（或如 bangumi 之中日双语），无须 per-language 请求。

前端 (Yohaku) 已支持 `lang=zh|ja|ko|en` 切换，后端 `@Lang()` 装饰器与
`RequestContext.currentLang()` 已就位（`apps/core/src/common/decorators/lang.decorator.ts`、
`apps/core/src/common/contexts/request.context.ts`）。本设计将 locale 引入
enrichment 缓存与 provider 拉取链路，使 link-card 与 hydrated map 按请求
locale 返回本地化文案。

## Goals

- `resolve(url)`、`hydrateUrls(urls)`、`getOne(provider, id)` 按请求 lang
  返回对应 locale 之 normalized 数据
- TMDB 按 locale 拉取 title/overview/genres
- 单语 provider（bangumi/neodb/github/leetcode/arxiv/netease/qq/self）
  保持现有行为，零代码变更
- Cache 按 `(provider, externalId, locale)` 三元组隔离，TTL/failure backoff
  各 locale 独立
- Rolling deploy（Dokploy 双 replica）期间新旧 pod 共存安全

## Non-Goals

- TMDB 本地化海报（`include_image_language` + `/images` 端点）—— 后续优化
- 自动按 site default locale 批量回填存量 cache —— 由 SWR 渐进填充即可
- Admin 一键"刷新该资源所有 locale"按钮 —— 可后续追加
- bangumi 双语字段拆为多行 —— 保持单行 `''`，前端按需展示 name/name_cn

## Architecture

### Locale 解析与 cache key

请求侧以 `@Lang()` 取 `query.lang || header['x-lang']`，经
`resolveRequestedLanguage` → `normalizeLanguageCode` 归一为 ISO-639-1 2 字母
码（`zh`/`ja`/`ko`/`en`/...）或 `undefined`（含哨兵 `'original'`）。

Service 层依 provider 能力决定实际 cache locale：

```
reqLocale = normalize(lang)               // string | undefined

if (provider.localeAware !== true) {
  cacheLocale = ''                         // 单语 provider，恒入默认行
} else if (reqLocale && supportedLocales.includes(reqLocale)) {
  cacheLocale = reqLocale                  // 命中支持列表
} else {
  cacheLocale = ''                         // 不支持之 locale → 默认行
}
```

`''` 哨兵代表"默认/locale-unaware"行：

- 单语 provider 之全部行
- locale-aware provider 之"未指定 lang"或"fallback"行

Redis key：`enrichment:resolve:<sha1(url)>:<cacheLocale>`，空 locale
即 `...:` 末尾。

### Schema 改动

```ts
// packages/db-schema/src/schema/enrichment.ts
export const enrichmentCache = pgTable(
  'enrichment_cache',
  {
    // ... 原有字段
    locale: varchar('locale', { length: 8 }).notNull().default(''),
  },
  (table) => [
    uniqueIndex('enrichment_provider_external_id_locale_uniq').on(
      table.provider,
      table.externalId,
      table.locale,
    ),
    index('enrichment_expires_at_idx').on(table.expiresAt),
  ],
)
```

选 `varchar(8) NOT NULL DEFAULT ''` 而非 `NULL`，理由：

- PG 唯一索引默认 `NULLs distinct`，须 `NULLS NOT DISTINCT` 方阻 `(p,id,NULL)` 重复，引入 PG 15+ 依赖与 Drizzle 版本风险
- `eq(locale, '')` 单一查询路径；`isNull` 路径会污染 `findManyByRefs` 之 inArray 拼接
- 类型层 `string` 较 `string | null` 简明
- `''` 即"默认行"哨兵，service 封装转换，对外 API 仍 `lang?: string`

### Provider interface

```ts
// providers/provider.interface.ts
export interface EnrichmentProvider<TRaw = unknown> {
  // ... 原有字段
  readonly localeAware?: boolean
  readonly supportedLocales?: readonly string[]

  fetch(id: string, locale?: string): Promise<EnrichmentResult<TRaw>>
}
```

Provider 矩阵：

| Provider | localeAware | supportedLocales      |
| -------- | ----------- | --------------------- |
| tmdb     | true        | `['zh','ja','ko','en']` |
| bangumi  | false       | —                     |
| neodb    | false       | —                     |
| github   | false       | —                     |
| leetcode | false       | —                     |
| arxiv    | false       | —                     |
| netease  | false       | —                     |
| qq       | false       | —                     |
| self     | false       | —                     |

`fetch` 之 `locale` 形参对单语 provider 实现可不读；service 层会强制传 `''`
之等价值。

### TMDB locale 映射与英文回填

TMDB 对冷门影视之非英 locale 响应常存"字段稀疏"现象——`overview` 返空
字符串、`title/name` 偶亦空。须在 provider 层做 en 回填，使 cache 行字段
不空。

**回填字段分级：**

| 字段                          | 随 locale 变 | 回填策略 |
| ----------------------------- | ------------ | -------- |
| `title` / `name`              | 是           | 空则取 en |
| `overview`                    | 是           | 空则取 en |
| `genres[].name`               | 是           | 不回填（TMDB 翻译完备）|
| `vote_average`, `vote_count`  | 否           | 不回填 |
| `release_date`, `first_air_date` | 否        | 不回填 |
| `poster_path`                 | 否（全球默认）| 不回填 |

**Provider 实现：**

```ts
// providers/tmdb/tmdb.provider.ts
private static readonly TMDB_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', en: 'en-US',
}

readonly localeAware = true
readonly supportedLocales = ['zh', 'ja', 'ko', 'en'] as const

async fetch(id: string, locale?: string): Promise<EnrichmentResult> {
  const language = locale ? TmdbProvider.TMDB_LANG_MAP[locale] : undefined
  const data = await this.client.fetch<TMDBMovieApiResponse>(
    `/3/${id}`,
    language ? { language } : undefined,
  )

  // 回填：仅当请求 locale 非 en 且关键字段空时拉 en
  let backfill: TMDBMovieApiResponse | undefined
  const needsBackfill =
    language &&
    language !== 'en-US' &&
    (isBlank(data.title || data.name) || isBlank(data.overview))
  if (needsBackfill) {
    try {
      backfill = await this.client.fetch<TMDBMovieApiResponse>(
        `/3/${id}`,
        { language: 'en-US' },
      )
    } catch (err) {
      // 回填失败不阻塞主路径
      this.logger.warn(`TMDB en backfill failed for ${id}: ${err.message}`)
    }
  }

  const title =
    pickNonBlank(data.title, data.name, backfill?.title, backfill?.name) || id
  const overview = pickNonBlank(data.overview, backfill?.overview)
  // ... 余字段直取 data
}

const isBlank = (s?: string | null) => !s || !s.trim()
const pickNonBlank = (...vals: (string | null | undefined)[]) =>
  vals.find((v) => v && v.trim()) ?? undefined
```

**rate-limit 评估：**冷门资源访问稀，每首访多 1 RT 可接受；常见资源主 fetch
字段满，无回填，保持 1 RT。后续可优化为 `/3/movie/{id}/translations` 单次
拉全语种本地选取（不在本期）。

`tmdb.client.ts` `fetch` 加 `opts?: { language?: string }`，存在则
`url.searchParams.set('language', opts.language)`。

## Service 流程

### `resolve(url, lang?)`

```
1. reqLocale = normalize(lang)
2. parsedUrl 解析；matched = providerRegistry.match
3. cacheLocale = resolveCacheLocale(provider, reqLocale)
4. redis hit by (url, cacheLocale)? → return
5. dbRow = repo.findByProviderAndExternalId(provider.name, match.id, cacheLocale)
   - hit 未过期: 写 redis, return
   - hit 过期非 backoff: enqueueRefresh(provider, id, cacheLocale); return stale
   - miss: fetchAndPersist(provider, id, { url, subtype, locale: cacheLocale })
```

### `hydrateUrls(urls, lang?)`

```
1. reqLocale = normalize(lang)
2. 每 url → ref { provider, externalId }; cacheLocale_i 各自算
3. refs[] = { provider, externalId, locale } 三元组
4. rows = repo.findManyByRefs(refs)  // SQL: 三元组 OR 拼接
5. 匹配 + SWR 触发 refresh
6. 缺失行 fallback：
   if cacheLocale_i !== '' && row not found:
     fallbackRow = repo.findByProviderAndExternalId(provider, id, '')
     if fallbackRow: out[url] = fallbackRow.normalized
     enqueueRefresh(provider, id, cacheLocale_i)  // 后台拉真行
```

Fallback 含义："首访 zh 行不存但 '' 行存 → 先返 ''，后台拉 zh"。
避免空白渲染。

### `prefetchUrls(urls, lang?)`、`scheduleDocPrefetch(doc)`

文档写入时调用方无 request lang。引入 config：

```ts
// thirdPartyServiceIntegration 或独立 site config
siteDefaultLocale?: string  // 缺省 ''
```

`scheduleDocPrefetch` 取 `siteDefaultLocale` 作为预取 locale。其余 locale
由首位访问者按 SWR 触发。

### `refresh(provider, id, lang?)`

仅刷指定 locale 行。admin 路由不传则刷 `''` 行（与默认 SWR 路径一致）。

### `invalidate(provider, id, lang?)`

`lang` 缺省 → 删 `(provider, id)` **所有 locale 行**（admin 清缓存语义）。
Repository 须支持 locale 可空之 delete 分支。

### `attachEnrichments(doc)`

调用方零改动。Service 内部用 `RequestContext.currentLang()` 自取，与
`cache.interceptor` / `translation-entry.interceptor` 同模式。测试以
`RequestContext.run` mock。

## Repository 改动

```ts
findByProviderAndExternalId(provider, externalId, locale = ''): Promise<EnrichmentRow | null>

findManyByRefs(refs: { provider; externalId; locale }[]): Promise<EnrichmentRow[]>
// SQL: 按 (provider, locale) 分组，每组 inArray(externalId, ids) AND eq(locale, X)，OR 合并

upsert(provider, externalId, url, normalized, raw, expiresAt, locale = ''): Promise<EnrichmentRow>
// onConflictDoUpdate.target = [provider, externalId, locale]

upsertIfAbsent({ ..., locale })
recordFailure(provider, externalId, error, locale = '')
deleteByProviderAndExternalId(provider, externalId, locale?: string)
// locale undefined → 删全 locale 行
listPaginated(page, size, { onlyFailed?, locale? })
mapRow → EnrichmentRow 加 locale 字段
```

`EnrichmentRow` 类型加 `locale: string`。

## API / Controller

```ts
@Get('resolve')
async resolve(@Query() q: ResolveQueryDto, @Lang() lang?: string, @Res(...) res) {
  const { result, stale } = await this.svc.resolve(q.url, lang)
  // 同前
}

@Get(':provider/*')
async getOne(@Param('provider') p, @Req() req, @Lang() lang?: string) {
  return this.svc.getOne(p, id, lang)
}

@Post('admin/refresh/:provider/*')
@Auth()
async refresh(@Param('provider') p, @Req() req, @Query('lang') lang?: string) {
  return this.svc.refresh(p, id, lang)
}

@Delete('admin/cache/:provider/*')
@Auth()
async invalidate(@Param('provider') p, @Req() req, @Query('lang') lang?: string) {
  await this.svc.invalidate(p, id, lang)
}

@Get('admin/list')
@Auth()
async list(@Query() q: AdminListQueryDto) {
  return this.svc.list(q.page, q.size, { onlyFailed: q.onlyFailed, locale: q.locale })
}
```

`AdminListQuerySchema` 加 `locale: z.string().optional()`。

`ProviderMeta` 类型加 `localeAware: boolean` 与 `supportedLocales?: readonly string[]`，
`/admin/providers` 自然透出，便 admin-vue3 渲染多语提示。

Admin 接口 `lang` 从 `@Query('lang')` 直取，不经 `@Lang()`，避免 admin
请求被全局 `x-lang` header 干扰。

## Migration（expand-contract，二 release）

依 `mx-migration-author` + Dokploy 双 replica rolling deploy，**须二 release**。
单 release 不可行之故：

- 旧 pod `upsert.target=[provider, externalId]`（二元唯一）。
- 若一次 release 既建三元索引、又删二元索引，旧 pod 之 ON CONFLICT 立失
  匹配，秒级窗口内 enrichment 写入全报错（`there is no unique or
  exclusion constraint matching the ON CONFLICT specification`）。
- 若保留二元索引：locale-aware provider 写 `(tmdb, movie/1, 'zh')` 会与
  已存 `(tmdb, movie/1, '')` 行**二元冲突**，upsert 覆盖 '' 行 → 数据破坏。
- 故 schema 与 code-locale 启用须分两 release 完成。

### Release N — schema 扩列、code 仅就位不启用

`apps/core/src/database/migrations/0006_enrichment_locale.sql`：

```sql
ALTER TABLE "enrichment_cache"
  ADD COLUMN "locale" varchar(8) NOT NULL DEFAULT '';
```

旧索引 `enrichment_provider_external_id_uniq`（二元）保留。存量行得
`locale=''`，二元唯一仍成立。

**code 行为**：
- Repository、Provider interface、controller `@Lang()` 接入皆完成
- Service 层 `resolve` / `hydrateUrls` 内**强制 `cacheLocale = ''`**（不调
  `resolveCacheLocale`，直传 ''）
- `upsert.target` 仍为 `[provider, externalId]`（二元）
- 即此 release service 行为对外等同旧版，`@Lang()` 之 lang 实际被忽略

**收益**：列就位、接口就位、新旧 pod 共存安全（皆按二元唯一写入）。

### Release N+1 — 切索引、启用 locale 写入

`apps/core/src/database/migrations/0007_enrichment_locale_index.sql`：

```sql
CREATE UNIQUE INDEX CONCURRENTLY "enrichment_provider_external_id_locale_uniq"
  ON "enrichment_cache" ("provider", "external_id", "locale");
-- migration-lint:allow=concurrent-index reason=read-heavy table; concurrent avoids write lock
--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "enrichment_provider_external_id_uniq";
```

`CONCURRENTLY` 须独立 statement、不在事务内。drizzle-kit 默认无事务包装；
若 generate 出之文件含 `BEGIN/COMMIT`，须手工剥离或加 `--no-transaction`
之 drizzle config。

**code 行为**：
- Service 层去除 `cacheLocale=''` 之硬编码，启用真 `resolveCacheLocale`
- `upsert.target` 改 `[provider, externalId, locale]`
- locale-aware provider 始据请求 lang 拉本地化版本

**rolling 期共存**：
- 迁移 mx-migrate one-shot 先跑完，方 deploy 新 pod
- 旧 pod（N 版，二元 target）退出前若仍写入：二元 ON CONFLICT 已无对应
  索引 → 报错。窗口取决于 Dokploy graceful shutdown（通常数秒）
- 容忍策略：N 版 deploy 时已停业务写入路径之必要性较低（enrichment 写主要
  来自 task queue 与首访，task queue 失败会重试，首访失败 204）—— 可接受
- 若不可接受秒级失败，可在 Release N+1 前先暂停 task queue 之
  `enrichment:refresh` scope，迁移后恢复

### Drizzle 生成

`drizzle-kit generate` 据 schema 一次性输出含列+索引之 SQL。须人工**拆为
两 migration 文件**，并将 schema 之三元索引改动延至 N+1 一并提交（即
N 版 schema 仅含新列、保留旧索引；N+1 版 schema 切为新索引）。

`pnpm -C apps/core run lint:migrations` 二者皆须通过。

## 测试

`apps/core/test/src/modules/enrichment/`：

- `enrichment.service.spec.ts`：
  - `resolve('xxx', 'zh')` 命中 zh 行
  - `resolve('xxx', 'zh')` zh 行缺 + '' 行存 → fallback + enqueue zh
  - `resolve('xxx', 'unknown')` → 落 ''
  - localeAware=false provider 任意 lang → 仅 '' 行
  - bangumi 之 `''` 行可正常返回中日双语字段
- `enrichment.service.hydrate.spec.ts`：
  - 多 url 多 locale 混合 hydrate，正确分组查询
  - 缺失 locale 行触发 fallback
- `enrichment.repository.spec.ts`（新增或扩）：
  - 三元组 upsert 行为
  - `findManyByRefs` 之三元组 inArray 分组
  - `deleteByProviderAndExternalId` 缺 locale 删全部
- `tmdb.provider.spec.ts`（如有）：
  - `fetch(id, 'zh')` 调 URL 含 `language=zh-CN`
  - `fetch(id, undefined)` URL 不含 language
  - `fetch(id, 'zh')` 主响应 overview 空 → 触发 en 回填，最终 description 取 en
  - `fetch(id, 'zh')` 主响应字段满 → 无 en 回填请求
  - `fetch(id, 'en')` 永不回填
  - `fetch(id, 'zh')` 回填请求失败 → 主结果照返（即使字段空），不抛错
- migration：`pnpm -C apps/core run lint:migrations` 须通过

## 风险与回滚

- **N 版 noop 之疑**：N 版用户访问 lang=zh，仍得英文（cacheLocale 硬编码
  为 ''）；待 N+1 deploy 后渐进填充。可接受。
- **回滚 N+1 code**：保留索引切换之 migration，仅回 code 至"二元 target +
  cacheLocale 硬编码为 ''"——但 N+1 已删旧索引，code 之 `target=
  [provider, externalId]` 将报错，故 code 回滚须连带回滚索引迁移
  （`CREATE old uniq idx CONCURRENTLY; DROP new idx CONCURRENTLY`）
- **回滚 N**：drop column locale；需先确认无新索引依赖之；DEFAULT '' 列
  drop 安全
- **TMDB rate limit**：每 locale 一次 fetch，4 locale × N 资源；首访填充期
  请求量 ×4，但渐进式（仅访问者触发），实际并发可控。叠加 en 回填后冷门
  资源首访为 2 RT，仍属可接受
- **Cache 行数**：locale-aware provider 行数 ×supportedLocales.length（最多
  ×4）；非 locale-aware 不变。enrichment_cache 体量小（缓存表），可接受

## Open Questions

- `siteDefaultLocale` 配置归处？建议加于 `thirdPartyServiceIntegration`
  之外，独立 site config 段（如有；若无暂留 `''` 即所有 prefetch 不预拉
  本地化版本）—— 留给实现期决
- TMDB 之 `country=` 参数（影响发布日期/票房等）暂不引入，本期仅 `language`
