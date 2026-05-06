# Link Card Unification (post / note / page) — Design

**Date**: 2026-05-06
**Status**: Approved
**Scope**: mx-core (`apps/core`, `packages/api-client`) + Yohaku (`apps/web`)
**Branch**: `feature/enrichment-module`
**Predecessor**: `2026-05-06-thinking-enrichment-unification-design.md`

## Background

prior spec 之 thinking 已统一走 enrichment。今扩至 post / note / page 长文之 link-card。

现 Yohaku 之 link-card 系：

- `apps/web/src/components/ui/link-card/plugins/` —— 13+ plugin（github 五种、tmdb、bangumi、leetcode、neodb、netease-music、qq-music、arxiv 等），各自 `fetch()` 走 client → `/api/*` proxy → upstream API
- 每 card 入视后才 fetch → `<LinkCardSkeleton>` 一闪 → CLS（Cumulative Layout Shift）
- mx-core 已有 `enrichment_cache` 与 `/enrichment/resolve?url=` 之统一接，13 typed providers + OG fallback 已立

文章 read flow 之 CLS 解：**inline preload** —— post / note / page detail 接口直随 response 注 cached enrichments map，frontend 取即得，不必 fetch。冷数据回退至 cache-miss path（skeleton + dynamic fetch）。

## Goals

1. **inline preload**：`GET /api/posts/:id` 等响应附 `enrichments: { [url]: EnrichmentResult }` map
2. **frontend 单一渲染**：unified `<LinkCard>` 据 category + subtype 分派 11 variants（已视觉锁定）
3. **cache miss 仍可用**：dynamic fallback `GET /enrichment/resolve?url=` + skeleton
4. **删 Yohaku `/api/*` proxies**：tmdb / bangumi / leetcode / music/netease / music/tencent / gh — 全弃
5. **删旧 plugin fetcher**：matchUrl 之逻辑既已在 mx-core 端，client plugin 整体废
6. **新视觉**：tokens-pure（n-1..10、ring-1 ring-border、rounded-md/lg、font-medium、accent ≤ 5%），per-type variants

## Non-Goals

- **无 save-time hook**：post / note / page 创建编辑不预 resolve
- **无 backfill**：既有 posts 不批量回填，cache 由 cold-path 渐充
- **无 schema 改**：`enrichment_cache` 已立
- **无 feature flag / canary**：直切
- **thinking 不动**：prior spec 已覆，本 spec 不复议
- **bilibili / webhook / healthz `/api/*`**：非 link-card 之用，留之
- **admin-vue3 不动**：其 `EnrichmentCard` 仅 thinking 用，不涉 post / note / page

## Architecture

### Read flow

```
 GET /api/posts/:id
   ├─ post.service.getById() returns entity
   ├─ urlExtractor.extractFromMarkdown(post.text)  // or .extractFromLexical(post.lexicalState)
   ├─ enrichmentService.hydrateUrls(urls): Record<url, EnrichmentResult>
   │    └─ for each url:
   │         ├─ providerRegistry.matchUrl(url) → (provider, externalId) | null
   │         ├─ if matched: SELECT * FROM enrichment_cache WHERE provider=$1 AND external_id=$2
   │         │              hit → push (url → result)
   │         │              miss → skip (cold path 解之)
   │         └─ if unmatched (无 provider): skip (cold path 走 OG fallback)
   └─ response: { ...post, enrichments }

 frontend <LinkCard url={u}>
   ├─ useEnrichmentMap() → preloaded map from page-level <EnrichmentMapProvider>
   ├─ if map[u] exists → dispatch variant 即渲（hot path, no CLS）
   └─ else → useQuery({ queryKey: ['enrichment-resolve', u], queryFn: () => api.enrichment.resolve(u) })
              ├─ pending → <LinkCardSkeleton variant=...>
              └─ resolved → dispatch variant
            （server-side cache 由 mx-core 之 enrichment.service 已担）
```

### URL extraction (encapsulated in enrichment module)

新立 `apps/core/src/modules/enrichment/url-extractor.service.ts`：

```ts
@Injectable()
export class UrlExtractorService {
  // markdown: 仅识"独占段落之单一 link"（标准 link-card 触发条件）
  extractFromMarkdown(content: string): string[]

  // lexical: 遍 JSON tree 取 link-card block 之 url
  extractFromLexical(state: LexicalEditorState): string[]
}
```

为何置于 enrichment module：

- 单一来源（post / note / page 共用）
- 与 `providerRegistry.matchUrl` 邻接，未来若需 backend 端 normalize 即就近
- thinking 之 url 提取（首单 url）现散于 app-migrate；可重构借此 helper 统一（follow-up）

`EnrichmentModule` exports `UrlExtractorService`，post / note / page module imports。

### Hydration helper

`EnrichmentService` 加：

```ts
async hydrateUrls(urls: string[]): Promise<Record<string, EnrichmentResult>> {
  const out: Record<string, EnrichmentResult> = {}
  await Promise.all(urls.map(async (url) => {
    const match = this.providerRegistry.matchAny(url)  // returns (provider, externalId) | null
    if (!match) return  // cold path 解之
    const cached = await this.repo.findByProviderAndId(match.provider, match.externalId)
    if (cached && !this.isStale(cached)) {
      out[url] = this.toResult(cached)
    }
  }))
  return out
}
```

注：

- 不 fetch upstream（save-time / read-time 皆不主动 resolve）
- stale 之 cache（过 `expiresAt`）视作 miss，由 cold-path refresh
- match 失败者亦视作 miss，由 cold-path OG fallback

### Endpoint

- `GET /enrichment/resolve?url=X` —— **不变**。frontend cold-path fallback 之用。已有 server cache、provider match、OG fallback。
- `GET /api/posts/:id` / `/api/notes/:id` / `/api/pages/:slug` —— response shape 加 `enrichments` 字段。

## Visual Design

unified `<LinkCard>` 据 `category` + `subtype` 分派 11 variants。皆 Yohaku tokens：n-1..10 scale、ring-1 ring-border、rounded-md/lg、font-medium、accent ≤ 5%。无 hover spotlight。

| # | Variant | Pattern | Visual signature |
|---|---|---|---|
| 1 | Movie / TV (TMDB) | poster-left | 2:3 cover、subtype caps、★ rating pill、year |
| 2 | Book (NeoDB / Bangumi book) | poster-left | 5:7 cover、author、★ rating |
| 3 | Album (Netease / QQ Music) | poster-left | 1:1 cover + ▶ glyph、artist、track count |
| 4 | GitHub Repo | link-card replica (image right) | language color wash 6% + 30 alpha tint border、★ count in title row |
| 5 | GitHub Issue | link-card | state octicon 引领 title（open=success / closed=merged 紫）、neutral paper、no rail / no wash |
| 6 | GitHub PR | link-card | branch / merge / closed octicons、`+adds −dels` mono、neutral paper |
| 7 | GitHub Discussion | link-card | comment-bubble icon 引领 title、neutral paper |
| 8 | GitHub User | profile card | 5rem 圆 avatar + hair ring + paper halo、name 大字、bio serif italic、stats with octicons |
| 9 | Arxiv Paper | ID-anchor (no cover) | arXiv ID mono badge top、cat·date·version、title、authors as "first · second · third · N more" |
| 10 | LeetCode | full-bar (no cover) | difficulty pill (semantic dot + text)、#N、title、AR、likes；tags pills 第二行 |
| 11 | Generic fallback | link-card | globe icon 28px on n-2 + hair ring、OG title / desc / host |

mockup 留档于 `.superpowers/brainstorm/15719-1778077612/content/`：

- `design-direction-v2.html` — 三 base directions
- `per-type-redesign-v2.html` — repo / paper / leetcode 之骨
- `per-type-icons-v4.html` — issue / pr / discussion / user / fallback（终态）
- `per-type-variants.html` — movie / book / music / repo（poster + link-card 演示）

## Component API

### `<LinkCard>`

```tsx
interface LinkCardProps {
  url: string
  className?: string
  // optional fallback when neither map nor /enrichment/resolve has data
  fallbackTitle?: string
}
```

内部：

```tsx
const LinkCard: FC<LinkCardProps> = ({ url, className }) => {
  const map = useEnrichmentMap()
  const inline = map[url]

  const { data, isLoading } = useQuery({
    queryKey: ['enrichment-resolve', url],
    queryFn: () => api.enrichment.resolve(url),
    enabled: !inline,                    // map 命中则不 fetch
    staleTime: 5 * 60_000,
  })

  const result = inline ?? data
  if (!result) return <LinkCardSkeleton />
  return dispatchVariant(result, className)
}
```

### `<EnrichmentMapProvider>`

页级 provider：

```tsx
<EnrichmentMapProvider value={post.enrichments ?? {}}>
  <PostContent body={post.text} />
</EnrichmentMapProvider>
```

外部无 provider 时 `useEnrichmentMap()` 返空对象 → LinkCard 走 cold path（保后向兼容，便于 share embed / preview surface）。

### Variant dispatch

```tsx
function dispatchVariant(r: EnrichmentResult, className?: string) {
  const key = `${r.category}:${r.subtype ?? '*'}`
  switch (key) {
    case 'media:movie':
    case 'media:tv':         return <MovieCard data={r} className={className} />
    case 'media:book':
    case 'book:*':           return <BookCard data={r} className={className} />
    case 'media:music':
    case 'music:album':
    case 'music:song':       return <AlbumCard data={r} className={className} />
    case 'developer:repo':   return <RepoCard data={r} className={className} />
    case 'developer:issue':  return <IssueCard data={r} className={className} />
    case 'developer:pr':     return <PrCard data={r} className={className} />
    case 'developer:discussion': return <DiscussionCard data={r} className={className} />
    case 'developer:user':   return <UserCard data={r} className={className} />
    case 'academic:paper':   return <PaperCard data={r} className={className} />
    case 'code:problem':     return <LeetcodeCard data={r} className={className} />
    default:                 return <FallbackCard data={r} className={className} />
  }
}
```

variant components 居 `apps/web/src/components/ui/link-card/variants/`，每件 ≤ 80 行（Yohaku 之 inline subcomponent 上限）。共享 atoms（`<LinkCardShell>`、`<MetaRow>`、`<StatePill>`、`<OctIcon>`）共置 `variants/atoms/`.

## Backend Changes

### `apps/core/src/modules/enrichment/`

**新**：

- `url-extractor.service.ts` — markdown + lexical extract，logic encapsulated
- `enrichment.service.ts::hydrateUrls(urls)` — bulk URL → cached EnrichmentResult map
- `provider.registry.ts::matchAny(url)` — 现 logic 散于 service.resolve()，重构出独立 helper（thinking flow 与 hydration flow 共用）

**不变**：

- `/enrichment/resolve` controller endpoint
- `enrichment_cache` 表
- 13 providers + OG fallback
- TTL / `expiresAt` / failure tracking

### `apps/core/src/modules/post/note/page`

各 service `getById` / `getBySlug` / list-detail：

```ts
const post = await this.postRepository.findById(id)
const urls = isLexical(post.text)
  ? this.urlExtractor.extractFromLexical(JSON.parse(post.text))
  : this.urlExtractor.extractFromMarkdown(post.text)
const enrichments = await this.enrichmentService.hydrateUrls(urls)
return { ...post, enrichments }
```

post / note / page 三 entities 皆可两种 `ContentFormat`（Markdown / Lexical），由 `isLexical(doc)` 之 helper 择 extract 路径。

list 接口（`/posts`、`/notes`）**不**注 enrichments —— list 不渲 link-card；仅 detail 注。

### `packages/api-client`

DTO 加可选字段：

```ts
interface PostModel {
  // ...existing fields
  enrichments?: Record<string, EnrichmentResult>
}
```

note / page DTO 同。`EnrichmentResult` 类型从 enrichment.types 导出。

## Frontend Changes (Yohaku)

### `apps/web/src/components/ui/link-card/`

**重写** `LinkCard.tsx`：

- 弃 plugin registry 之 `pluginMap.get(source)`
- 取 `EnrichmentMapContext` 之 inline map
- cold path 走 `useQuery` + `api.enrichment.resolve(url)`
- dispatch by category + subtype

**新** `variants/`：

```
variants/
├─ atoms/
│  ├─ LinkCardShell.tsx       // base flex shell with paper bg + ring
│  ├─ MetaRow.tsx             // dot-separated meta line with icon support
│  ├─ StatePill.tsx           // semantic dot + text pill
│  ├─ OctIcon.tsx             // octicon SVG mapper (issue / pr / merge / discussion / etc)
│  └─ HostStamp.tsx           // n-2 image-slot with globe icon for fallback
├─ MovieCard.tsx
├─ BookCard.tsx
├─ AlbumCard.tsx
├─ RepoCard.tsx
├─ IssueCard.tsx
├─ PrCard.tsx
├─ DiscussionCard.tsx
├─ UserCard.tsx
├─ PaperCard.tsx
├─ LeetcodeCard.tsx
├─ FallbackCard.tsx
└─ index.ts
```

**新** `EnrichmentMapContext.tsx`：

- `EnrichmentMapProvider` value prop
- `useEnrichmentMap()` hook with empty default

**删**：

- `plugins/` — 全。matchUrl logic 已落 mx-core providers；client fetch 不复需
- `LinkCard.module.css` — 由 variants tokens 替（保留必要部分若有 print 等）
- `hooks/useCardFetcher.ts` — 由 `useQuery` inline 替
- `enums.tsx`（LinkCardSource）— 不再用
- `types.ts`（LinkCardData / LinkCardPlugin）— 替为 `EnrichmentResult`

**保**：

- `LinkCardSkeleton.tsx` — cold path 仍用；按 variant 出 size-stable 占位
- `ShadowLinkCard.tsx` — rich-content shadow DOM 之入口；接 EnrichmentMapProvider

### `apps/web/src/app/api/`

**删**：

- `tmdb/`
- `bangumi/`
- `leetcode/`
- `music/netease/`
- `music/tencent/`
- `gh/`

**留**：

- `bilibili/` — 非 link-card 用
- `webhook/`、`healthz/` — 不涉

### `apps/web/src/components/ui/rich-content/LexicalContent.tsx`

`linkCardFetchContext` adapter map 全删。LexicalContent 内 `link-card` block 直渲 `<LinkCard url={...}>`，由 EnrichmentMapProvider 注 data。

### `apps/web/src/lib/github.ts`

`fetchGitHubApi` 之 `Promise.any([direct, proxy])` 之 proxy 半弃（`/api/gh` 删）。link-card 已不复需此 helper（皆走 mx-core enrichment）；唯查全 repo 若无他用，则整删。重 search consumer 后定。

### `apps/web/src/components/modules/thinking/enrichment-card.tsx`

不动。thinking 已用之，不涉本 spec。

### Page integration

```tsx
// apps/web/src/app/[locale]/posts/[category]/[slug]/page.tsx
const post = await api.post.getBySlug(...)
return (
  <CurrentPostDataProvider data={post}>
    <EnrichmentMapProvider value={post.enrichments ?? {}}>
      <PostTitle />
      <PostMetaBar />
      <PostContent />     {/* contains <Markdown> 或 <LexicalContent> with <LinkCard> */}
    </EnrichmentMapProvider>
  </CurrentPostDataProvider>
)
```

note / page detail page 同。

## Migration / Rollout

### Phase 1 — backend

1. `UrlExtractorService` 新建 + tests
2. `providerRegistry.matchAny(url)` helper 抽出
3. `EnrichmentService.hydrateUrls()` + tests
4. post / note / page service 注 `enrichments`
5. api-client DTO 加 field

### Phase 2 — frontend

1. variants/atoms 与 11 variant 组件
2. `EnrichmentMapProvider` + context
3. `LinkCard` 重写
4. detail pages 包 provider
5. LexicalContent adapter 弃

### Phase 3 — cleanup

1. 删 plugins / 旧 LinkCard 资源
2. 删 `/api/*` proxies
3. 删 dead types（LinkCardSource、LinkCardTypeClass 等）
4. `lib/github.ts` 简化

各 phase 一 commit。一 PR 合（避 frontend 与 backend 之 release skew —— 本仓 monorepo，可同 release）。

### Cache 暖化

无 backfill。cache 渐充：每 URL 首访触 cold path → `/enrichment/resolve` → upsert → 下次 hot。

热 post（频访）数日内 cache 满；冷 post 之访亦无碍（skeleton 一闪 + cache 即写）。

## Testing

### Backend

- **Unit `UrlExtractorService`**：
  - markdown 单 link 段落识别（边缘：trailing whitespace、image link 排除、ref-style link、html `<a>`）
  - lexical 遍历正确（涵 nested 节点）
  - 返列 dedupe（同 URL 多次出现取一）
- **Unit `providerRegistry.matchAny`**：13 providers 之 happy + edge URL
- **Unit `EnrichmentService.hydrateUrls`**：
  - 全 hit
  - 全 miss
  - 部分 stale（过 expiresAt）
  - URL match 失败（OG fallback 候选）
- **Integration**：
  - `GET /api/posts/:id` 返 `enrichments` 字段
  - 各 URL 形式测：md block-link / lexical / 混合

### Frontend

- **Unit each variant**：sample EnrichmentResult fixture 渲染稳定（snapshot 或 testing-library 文本断言）
- **Unit `dispatchVariant`**：每 category + subtype 路径正确
- **Unit `LinkCard`**：
  - inline map 命中 → 不 fetch
  - inline 缺 → fetch + skeleton → 渲
  - server 失败 → fallback skeleton 不消（或返裸链）
- **Integration**：detail page rendered with map → link cards 即渲

### E2E（可选）

post detail 含 GitHub repo + arxiv + leetcode + 未匹 URL，验：

- map 命中类秒渲
- 未匹类 cold path skeleton → 数据 → 卡

## Risks

1. **URL canonicalization**：同 target 有多 URL 形（`themoviedb.org/movie/123-name` vs `/movie/123`）。cache key (`provider`, `externalId`)，故不同 URL 形指同 row。`hydrateUrls` 之 map key 用 **原 URL 字串**（与 body 中之 link href 完全等），避前端字符匹配差异。
2. **`/enrichment/resolve` 之 abuse**：公开端点可触 server-side HTML fetch。防：
   - 复用现 IP rate-limit infra（与 OG fallback 同等待）
   - 私有 IP 段 / 内部 hostname 之 deny list（fetch 之时拒）
3. **首访 skeleton flash**：冷 post 之首访仍 CLS。可接 —— 用户取 simplicity over uniformity。若日后成痛，加 follow-up 之 save-time eager resolve。
4. **stale data**：`expiresAt` 已存。后续起 cron job 后台 refresh（follow-up）。
5. **GitHub direct fetch**：现 `lib/github.ts` 之 direct fetch 仍 client-side。如 rate-limit 有限，应改为强制走 backend `/enrichment/resolve` —— 此 spec 下既删 proxy，唯余一径。

## Out of Scope (Follow-up)

- Cron job 后台 refresh expired cache
- Save-time eager resolve（如首访 CLS 实痛）
- Backfill script（如热门旧 post 大量冷 cache 之苦）
- Hover preview / `<Peek>` 之集成
- Admin UI for cache invalidation per URL（现仅 per provider/id）
- thinking module 之 url-extractor 重构借本 spec 之 helper

## File-level Summary

### mx-core 新增

- `apps/core/src/modules/enrichment/url-extractor.service.ts`
- `apps/core/src/modules/enrichment/url-extractor.service.spec.ts`
- `apps/core/src/modules/enrichment/provider.registry.ts`（matchAny 抽出，若现散于 service 中）

### mx-core 修改

- `apps/core/src/modules/enrichment/enrichment.service.ts` — 加 `hydrateUrls`
- `apps/core/src/modules/enrichment/enrichment.module.ts` — exports UrlExtractorService
- `apps/core/src/modules/post/post.service.ts` — 注 enrichments
- `apps/core/src/modules/note/note.service.ts` — 同
- `apps/core/src/modules/page/page.service.ts` — 同
- `packages/api-client/src/types/...` — 加字段

### Yohaku 新增

- `apps/web/src/components/ui/link-card/EnrichmentMapContext.tsx`
- `apps/web/src/components/ui/link-card/variants/` — 11 variants + atoms
- `apps/web/src/components/ui/link-card/dispatch.ts`

### Yohaku 修改

- `apps/web/src/components/ui/link-card/LinkCard.tsx` — 重写
- `apps/web/src/components/ui/link-card/LinkCardSkeleton.tsx` — variant-aware sizes
- `apps/web/src/components/ui/rich-content/LexicalContent.tsx` — 删 adapter
- 各 detail page tsx — 包 provider

### Yohaku 删除

- `apps/web/src/components/ui/link-card/plugins/` — 全
- `apps/web/src/components/ui/link-card/LinkCard.module.css`
- `apps/web/src/components/ui/link-card/hooks/useCardFetcher.ts`
- `apps/web/src/components/ui/link-card/enums.tsx`
- `apps/web/src/components/ui/link-card/types.ts`（LinkCardData/Plugin）—— 改用 EnrichmentResult
- `apps/web/src/app/api/tmdb/`
- `apps/web/src/app/api/bangumi/`
- `apps/web/src/app/api/leetcode/`
- `apps/web/src/app/api/music/netease/`
- `apps/web/src/app/api/music/tencent/`
- `apps/web/src/app/api/gh/`

## Acceptance

1. `GET /api/posts/:slug` 返 `enrichments` 字段，含已 cache URL
2. post detail 页之 link-card：cache hit 类无 skeleton 闪、cache miss 类 skeleton → 数据
3. 11 variants 渲染分别匹各类 enrichment data
4. Yohaku `/api/*` 6 路径已删
5. plugins/ + 旧 LinkCard 资源已删
6. lint + typecheck pass、unit test pass
7. e2e（如有）：post 含 5 类 link card 之渲染稳定
