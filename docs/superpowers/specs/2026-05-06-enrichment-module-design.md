# Enrichment Module — Third-Party URL Resolver

**Status**: Proposed
**Date**: 2026-05-06
**Owner**: Innei

## Background

Yohaku 前端现有 13 个 link-card plugin（GitHub × 5、TMDB、Bangumi、NeoDB、网易/QQ 音乐、Arxiv、Leetcode、mx-space），各自在浏览器/Next.js edge 反代中抓取第三方 metadata。问题：

1. **Token 散落**：`GH_TOKEN`、`TMDB_API_KEY` 寄于 Yohaku env，site owner 须于多个前端项目分别配置
2. **元数据重复**：recently 落库 metadata 是 plugin 抓取结果之复制；将来 lexical 渲染等其他消费者亦需各自抓
3. **扩展受限**：每加一前端（admin、未来站点）皆需复制反代与 plugin
4. **限流分散**：各前端各 IP 各反代命中第三方 quota 上限

## Goals

- **A. Token 集中管理** — 站长在 mx-core admin 一处配置所有第三方凭据
- **C. 元数据落库共享** — 解析结果存于 mx-core，多消费者共用
- **D. 第三方扩展机制** — provider 框架使新平台易加（进程内注册）
- **E. 多前端复用** — Yohaku、admin、未来站点皆走 mx-core 单一 API

## Non-Goals

- 缓存复用（B）非主要动机；实施中自然带 Redis 短缓
- 动态 manifest / DSL provider（无 TypeScript 即可注册）— 暂不做，YAGNI
- provider 之 cron 主动 refresh — 后议
- 第三方 API 真实集成测试入 CI

## Design Decisions

| 决策点 | 选定 | 理由 |
|---|---|---|
| 模块名 | `enrichment` | linkcard 是前端组件名；enrichment 描述「元数据增益」之行为 |
| Provider 注册 | 进程内（TypeScript + NestJS DI） | 表达力完全，类型安全 |
| Token 存储 | server config 嵌套 schema | 复用 admin form 渲染；不保留 env 兜底 |
| API shape | 双路并存 | `/resolve?url=` 主用，`/<provider>/<id>` 供 admin/内部 |
| 持久化 | PG `enrichment_cache` 表 + Redis 短缓 | 单一来源；recently 引用 |
| recently 关系 | 引用 + 一次性回填 + cleanup | 单一来源、避免漂移 |
| 鉴权 | 全公开 + cache-first + IP throttle | cache hit 极廉，限流兜底 |
| 数据迁移 | 并入 `pnpm migrate`（schema + data jobs） | 单机 docker compose 无 deploy pipeline 编排 |

## Architecture

### 1. 模块结构

```
apps/core/src/modules/enrichment/
  enrichment.module.ts
  enrichment.controller.ts
  enrichment.service.ts
  enrichment.repository.ts
  enrichment.schema.ts
  enrichment.types.ts
  providers/
    provider.token.ts            # @EnrichmentProvider() decorator + DI token
    provider.registry.ts         # 启动期收集所有 @EnrichmentProvider
    github/
      github-repo.provider.ts
      github-commit.provider.ts
      github-issue.provider.ts
      github-pr.provider.ts
      github-discussion.provider.ts
      github.client.ts           # fetch 封装，token 从 ConfigsService
    tmdb/
      tmdb.provider.ts           # tv + movie 合一，subtype 区分
      tmdb.client.ts
    bangumi/
      bangumi.provider.ts
    neodb/
      neodb-book.provider.ts
    arxiv/
      arxiv.provider.ts
    leetcode/
      leetcode.provider.ts
    netease/
      netease-music.provider.ts
    qq/
      qq-music.provider.ts
    self/
      mx-space.provider.ts       # 复用既有 PostService/NoteService，不发 HTTP
```

`provider.registry.ts` 启动时用 NestJS `DiscoveryService` 收集所有 `@EnrichmentProvider()` 装饰之类，按 `priority` 倒序排，存入注册表。

### 2. Provider 抽象与数据 shape

```typescript
// enrichment.types.ts

export interface EnrichmentProvider<TRaw = unknown> {
  readonly name: string                   // 'gh-repo' 'tmdb-movie' ...
  readonly displayName: string
  readonly category: string               // 自由字符串：'github' 'media' 'academic' 'code' 'self'
  readonly priority: number
  readonly defaultTtl: number             // 秒；service 据此算 expiresAt

  matchUrl(url: URL): UrlMatchResult | null
  isValidId(id: string): boolean
  fetch(id: string): Promise<EnrichmentResult<TRaw>>

  readonly requiredConfigKeys?: string[]    // configs 路径，如 'thirdPartyServiceIntegration.github.token'
  readonly featureGateConfigKey?: string    // 站点级开关 key
}

export interface UrlMatchResult {
  id: string
  fullUrl: string
  subtype?: string                          // 'movie' 'tv' 'repo' 'pr' 'issue' ...
}

export interface EnrichmentResult<TRaw = unknown> {
  // 核心展示
  title: string
  description?: string
  image?: EnrichmentImage
  url: string

  // 分类
  category: string                          // provider.category 同
  subtype?: string

  // 时间
  publishedAt?: string                      // ISO；内容发布时间
  fetchedAt: string                         // ISO；service 注

  // 通用键值属性，前端按 key 自维护图标映射
  attributes?: EnrichmentAttribute[]

  // 视觉提示
  color?: string                            // provider 自决（GitHub 按语言色、媒体 uniqolor）

  // 副链接（PR commits、TMDB trailer ...）
  links?: Array<{ rel: string; url: string; label?: string }>

  // 原始数据；默认 API 响应不含，admin endpoint 携带 ?include=raw
  raw?: TRaw
}

export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  blurhash?: string
}

export interface EnrichmentAttribute {
  key: string                               // 'stars' 'rating' 'language' 'isbn' ...
  value: string | number | boolean
  label?: string                            // 英文 fallback；i18n 与图标皆前端按 key 自决
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}
```

要点：

- `category` 之合法值由 registry 启动期收集去重，admin 可见列表，但 provider 声明侧无字面联合
- `attributes` 以通用键值替代散字段（GithubMetadata.stars / MediaMetadata.rating 等），provider 可自由添加新维度
- `attributes.key` 即契约 — 前端按 key 维护图标/标签映射；新 key 引入须前后端协同
- `format` 给前端通用渲染兜底（旧前端见未知 key 仍能按 format 显示）
- 复杂布局（如 TMDB 海报竖向）前端按 `category`/`subtype` 自决，server 不掺入 className
- 类型由 `@mx-space/api-client` 统一出，Yohaku/admin 共用

### 3. 数据库 schema

`apps/core/src/database/schema/enrichment.ts`：

```typescript
export const enrichmentCacheTable = pgTable(
  'enrichment_cache',
  {
    id: snowflakeId().primaryKey(),
    provider: varchar('provider', { length: 64 }).notNull(),
    externalId: varchar('external_id', { length: 256 }).notNull(),
    url: text('url').notNull(),

    normalized: jsonb('normalized').$type<EnrichmentResult>().notNull(),
    raw: jsonb('raw'),

    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    failureCount: integer('failure_count').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => ({
    providerExternalIdUniq: uniqueIndex('enrichment_provider_external_id_uniq')
      .on(t.provider, t.externalId),
    expiresAtIdx: index('enrichment_expires_at_idx').on(t.expiresAt),
  }),
)
```

`recently` 表加二列：

```typescript
enrichmentProvider: varchar('enrichment_provider', { length: 64 }),
enrichmentExternalId: varchar('enrichment_external_id', { length: 256 }),
// 索引：(enrichment_provider, enrichment_external_id)
```

旧 `metadata` jsonb 字段于本期保留作 backfill 期 fallback，下一 release 之 contract migration 删之。

**Redis 短缓**：key `enrichment:resolve:<sha1(url)>`，TTL 600s，存 `EnrichmentResult` JSON。

**Migration 规范**：所有 schema 变更走 expand-contract（参见 `mx-migration-author` skill）。本期 PR 仅 expand（CREATE 表 + 加列），无 destructive；`metadata` 列删除留待下一 release。

### 4. Configs 嵌套 schema

`configs.schema.ts:401` `ThirdPartyServiceIntegrationSchema` 重塑为嵌套：

```typescript
const GitHubIntegrationSchema = section('GitHub', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
  token: field.password(z.string().optional(), 'Personal Access Token', {
    description: '调 GitHub API；遇限流则填',
  }),
})

const TmdbIntegrationSchema = section('TMDB', {
  enabled: field.toggle(z.boolean().optional().default(false), '启用'),
  apiKey: field.password(z.string().optional(), 'API Key'),
})

const BangumiIntegrationSchema = section('Bangumi', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
  accessToken: field.password(z.string().optional(), 'Access Token'),
})

const NeoDBIntegrationSchema = section('NeoDB', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
})

const ArxivIntegrationSchema = section('Arxiv', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
})

const LeetcodeIntegrationSchema = section('Leetcode', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
})

const NeteaseMusicIntegrationSchema = section('网易云音乐', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
})

const QQMusicIntegrationSchema = section('QQ 音乐', {
  enabled: field.toggle(z.boolean().optional().default(true), '启用'),
})

export const ThirdPartyServiceIntegrationSchema = section('第三方服务集成', {
  github: GitHubIntegrationSchema,
  tmdb: TmdbIntegrationSchema,
  bangumi: BangumiIntegrationSchema,
  neodb: NeoDBIntegrationSchema,
  arxiv: ArxivIntegrationSchema,
  leetcode: LeetcodeIntegrationSchema,
  neteaseMusic: NeteaseMusicIntegrationSchema,
  qqMusic: QQMusicIntegrationSchema,
})
```

#### 4.1 DSL util 补丁

`configs.dsl.util.ts` 之 `extractField`（line 310-316）现见嵌套 ZodObject 已能递归提 `field.fields`，但无 section title 概念。补：

```typescript
// FormField 加：
subsection?: { title: string; description?: string }

// extractField 内：
if (unwrapped instanceof z.ZodObject && component !== 'select') {
  const nestedFields = extractFields(unwrapped)
  if (nestedFields.length > 0) {
    field.fields = nestedFields
    const nestedMeta = getMeta(unwrapped)
    if (nestedMeta?.title) {
      field.subsection = { title: nestedMeta.title, description: nestedMeta.description }
    }
  }
}
```

admin-vue3 那侧识别 `subsection`，渲染卡片/折叠面板 — cross-repo 依赖项。

#### 4.2 数据迁移（expand-contract）

旧：`thirdPartyServiceIntegration: { githubToken: 'xxx' }`
新：`thirdPartyServiceIntegration: { github: { enabled: true, token: 'xxx' }, tmdb: {...}, ... }`

**Phase 1 — expand（与 schema 嵌套化同 PR）**

1. SQL migration（`apps/core/src/database/migrations/00XX_third_party_nested.sql`）：

```sql
UPDATE options
SET value = jsonb_set(
  value - 'githubToken',
  '{github}',
  jsonb_build_object(
    'enabled', true,
    'token', COALESCE(value -> 'githubToken', '""'::jsonb)
  )
)
WHERE name = 'thirdPartyServiceIntegration'
  AND value ? 'githubToken'
  AND NOT (value ? 'github');
```

幂等：`WHERE NOT (value ? 'github')` 防重；`COALESCE` 兜空。

2. `ConfigsService.get('thirdPartyServiceIntegration')` 加 `normalizeThirdParty()` 兜底：见旧 shape（顶层 `githubToken`）则就地转新 shape 返回，不写库。
3. `ConfigsService` 写入校验：旧字段提交者写前一律转新。

**Phase 2 — contract（下一 release）**

- 删 `normalizeThirdParty()` 与旧字段提交兼容
- 不需 SQL — 旧字段已于 Phase 1 之 `value - 'githubToken'` 移除

**不保留 env 兜底**：token 唯一来源为 server config。空则 provider resolve 时返 `502 + { reason: 'token_missing' }`。

### 5. API endpoints

```typescript
@ApiController('enrichment')
export class EnrichmentController {
  // 主路：前端编辑器/渲染器走此
  @Get('resolve')
  @HttpCache({ ttl: 600 })
  async resolve(@Query('url') url: string): Promise<EnrichmentResult>

  // 细路：已知 provider+id 时直查
  @Get(':provider/:id(*)')
  async getOne(
    @Param('provider') provider: string,
    @Param('id') id: string,
  ): Promise<EnrichmentResult>

  // admin only
  @Get('admin/list')
  @Auth()
  async list(@Query() q: PagerDto): Promise<Paginated<EnrichmentRow>>

  @Post('admin/refresh/:provider/:id(*)')
  @Auth()
  async refresh(...): Promise<EnrichmentResult>

  @Delete('admin/cache/:provider/:id(*)')
  @Auth()
  async invalidate(...): Promise<void>

  @Get('admin/providers')
  @Auth()
  async providers(): Promise<ProviderMeta[]>
}
```

#### 5.1 `resolve` 流程

```
url
 ├─ Redis hit? → return
 ├─ provider = registry.match(url)；未命中 → 404
 ├─ provider 未启用 → 410 { disabled: true, provider }
 ├─ provider token 缺 → 502 { reason: 'token_missing', provider }
 ├─ DB cache hit (未过期) → write Redis → return
 ├─ DB cache hit (已过期) + failureCount 在 backoff 期 → return stale + warn header
 ├─ provider.fetch(id) 成功 → upsert DB → write Redis → return
 └─ provider.fetch(id) 失败 → upsert failureCount++ → 若 stale 在则返 stale, 否 502
```

#### 5.2 限流与鉴权

- 全公开（无 API key）
- IP throttle：mx-core 既有 `ThrottlerGuard`
- cache-first 设计使第三方 quota 仅消于 cache miss；hit 时极廉，限流可宽
- admin endpoint 走 `@Auth()`

#### 5.3 响应规范

- snake_case：mx-core 既有 `JSONTransformInterceptor` 自动转
- 响应直接为 `EnrichmentResult`（非数组），`ResponseInterceptor` 不包 wrapper
- `raw` 默认不含，admin endpoint 加 `?include=raw` 时携带

### 6. recently 改造与 backfill

#### 6.1 写入路径

- 前端（admin / Yohaku）创建 recently 时，仅传 `url`，不再传 metadata
- recently service 内调 `enrichmentService.resolve(url)` 得 `(provider, externalId)`，存入 `recently.enrichmentProvider/enrichmentExternalId`
- recently 行不复制 normalized

#### 6.2 读取路径

- repository 查 recently → service 按 `(provider, externalId)` 批量从 `enrichment_cache` 拉 normalized → 拼入响应 `enrichment` 字段
- API shape：`{ ...recently, enrichment: EnrichmentResult | null }`
- 旧行（`enrichmentProvider` 为 NULL，`metadata` 在）→ fallback 用旧 metadata 拼 enrichment 形态。backfill 完成后此分支死代码

#### 6.3 Backfill — 并入 `pnpm migrate`

**思路**：mx-core 既有 `pnpm -C apps/core run migrate` 跑 schema migration。扩之，链式跑「schema migrate → 注册之 data jobs」。单 service、单命令、单机/Dokploy/k8s 皆同。

**注册框架**：

```typescript
// apps/core/src/maintenance/data-jobs.registry.ts
export interface DataJob {
  readonly id: string                       // marker key, e.g. 'recently-enrichment-backfill-v1'
  readonly description: string
  run(ctx: JobContext): Promise<JobResult>
}

@Injectable()
export class DataJobsRunner {
  constructor(
    @Inject(DATA_JOBS) private readonly jobs: DataJob[],
    private readonly db: DatabaseService,
    private readonly options: OptionsRepository,
  ) {}

  async runAll(): Promise<RunSummary> {
    for (const job of this.jobs) {
      const lockKey = hashText(`data-job:${job.id}`)
      const got = await this.db.execute(sql`SELECT pg_try_advisory_lock(${lockKey})`)
      if (!got.rows[0].pg_try_advisory_lock) {
        throw new Error(`Job ${job.id} lock contended — another migrate process running`)
      }
      try {
        const marker = await this.options.get(`data-job:${job.id}`)
        if (marker?.done) continue
        const result = await job.run({ db: this.db, options: this.options })
        await this.options.set(`data-job:${job.id}`, { done: true, at: new Date(), result })
      } finally {
        await this.db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`)
      }
    }
  }
}
```

**入口改造**：`apps/core/scripts/migrate.ts`

```typescript
async function main() {
  await runDrizzleMigrate()                 // schema
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  await app.get(DataJobsRunner).runAll()    // data
  await app.close()
}
```

**Job 实现**：`apps/core/src/maintenance/jobs/recently-enrichment-backfill.job.ts`

```typescript
@Injectable()
export class RecentlyEnrichmentBackfillJob implements DataJob {
  readonly id = 'recently-enrichment-backfill-v1'
  readonly description = '回填 recently 引用 enrichment_cache'

  async run(ctx: JobContext) {
    let processed = 0, skipped = 0, errors = 0
    let cursor: bigint | null = null
    const PAGE = 200
    while (true) {
      const rows = await this.recentlyRepo.findChunk({
        whereSql: sql`metadata IS NOT NULL AND enrichment_provider IS NULL`,
        afterId: cursor,
        limit: PAGE,
      })
      if (rows.length === 0) break
      for (const row of rows) {
        const inferred = inferProviderFromMetadata(row.metadata, row.type)
        if (!inferred) { skipped++; continue }
        try {
          await this.enrichmentRepo.upsertIfAbsent({
            provider: inferred.provider,
            externalId: inferred.externalId,
            url: row.url,
            normalized: convertLegacyMetadata(row.metadata, inferred.provider, row.url),
            raw: null,
            fetchedAt: row.createdAt,
            expiresAt: new Date(0),             // 视为已过期 — 下次 resolve 必重抓
          })
          await this.recentlyRepo.update(row.id, {
            enrichmentProvider: inferred.provider,
            enrichmentExternalId: inferred.externalId,
          })
          processed++
        } catch (e) {
          errors++
          this.logger.warn(`Failed for recently ${row.id}: ${e.message}`)
        }
      }
      cursor = rows[rows.length - 1].id
    }
    return { processed, skipped, errors }
  }
}
```

**docker compose 既有 `mx-migrate` service 不需改**，命令仍是 `pnpm migrate`。

**rolling deploy 时序**：

1. **期 N**（本期 PR）：发出含「schema migrate（recently 加 enrichment_* 列、CREATE enrichment_cache）+ data job（回填 + 写引用）」之版本。`mx-migrate` 先跑，新旧 pod 共存期：新 pod 用新引用，旧 pod 仍读旧 metadata（schema 加列不删，旧 pod 不感知新列）
2. **期 N+1**：删 `metadata` 列之 contract migration；删 fallback 代码

### 7. Yohaku 前端改造

前端 plugin 之 `fetch()`/`fetchRawMetadata()` 数据抓取尽数搬至 mx-core enrichment service。前端仅余 UI 渲染层。

**新形态**：

```typescript
// apps/web/src/components/ui/link-card/types.ts
export interface LinkCardRenderer {
  matches(result: EnrichmentResult): boolean
  render(result: EnrichmentResult): LinkCardData
}

// apps/web/src/components/ui/link-card/renderers/github-repo.tsx
export const githubRepoRenderer: LinkCardRenderer = {
  matches: (r) => r.category === 'github' && r.subtype === 'repo',
  render: (r) => ({
    title: (
      <span className="flex items-center gap-2">
        <span className="flex-1">{r.title}</span>
        {(r.attributes?.find(a => a.key === 'stars')?.value as number) > 0 && (
          <span className="...">
            <i className="i-mingcute-star-line" />
            {r.attributes!.find(a => a.key === 'stars')!.value}
          </span>
        )}
      </span>
    ),
    desc: r.description,
    image: r.image?.url,
    color: r.color,
  }),
}
```

**取数路径**：

```typescript
// apps/web/src/lib/enrichment.ts
export async function fetchEnrichment(url: string): Promise<EnrichmentResult> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL
  const res = await fetch(`${apiBase}/api/v2/enrichment/resolve?url=${encodeURIComponent(url)}`, {
    next: { revalidate: 600 },
  })
  if (res.status === 410) throw new EnrichmentDisabledError()
  if (!res.ok) throw new Error(`enrichment failed: ${res.status}`)
  return res.json()
}
```

**删除清单**：

- `apps/web/src/app/api/gh/[...all]/route.ts`
- `apps/web/src/app/api/tmdb/[...all]/route.ts`
- `apps/web/src/app/api/bangumi/[...all]/route.ts`
- `apps/web/src/app/api/music/netease/route.ts` 及 `crypto.ts`
- `apps/web/src/app/api/music/tencent/route.ts`
- `apps/web/src/app/api/leetcode/route.ts`
- `apps/web/src/lib/github.ts`
- env：`GH_TOKEN`、`TMDB_API_KEY` 等于 Yohaku 侧移除

**保留**：

- `apps/web/src/components/ui/link-card/` 组件壳（ShadowLinkCard 等）
- 各 renderer.tsx（仅 UI）
- `RecentlyTypeEnum` 之消费侧

**recently 创建**：前端仅传 `url`；旧 admin 客户端若仍传 metadata，server 侧忽略并取 url 重抓 — 兼容期容错。

**类型共享**：`EnrichmentResult` 等由 `@mx-space/api-client` 出，Yohaku 与 admin-vue3 共用。

### 8. 测试策略

#### 8.1 Provider 单元测试

`apps/core/test/src/modules/enrichment/providers/*.spec.ts`：

- `matchUrl` 之正反例（命中 / 拒域 / 拒多段 path）
- `fetch` 之正常归一（assert `attributes` 含期望 key/value）
- `fetch` 之 token 缺失抛 `TokenMissingError`
- 第三方 API mock 用 `nock` 或注入 fake client

#### 8.2 Service 单元测试

缓存策略与错误处理矩阵：

- Redis hit → 跳 DB
- DB hit + 未过期 → 跳 fetch
- DB hit + 过期 + failure backoff → 返 stale
- provider 未启 → 410
- token 缺 → 502
- fetch 失败 + DB 有 stale → 返 stale + warn header
- fetch 失败 + 无 stale → 502

#### 8.3 E2E

`apps/core/test/e2e/enrichment.controller.e2e-spec.ts`：

- `createE2EApp` + `startPgTestContainer` + redis mock
- `nock` mock provider 之第三方 API
- 验 `/api/v2/enrichment/resolve?url=...` 全链路：URL → match → cache miss → fetch → upsert → return
- 二次 resolve 验 cache hit
- admin endpoint `/admin/refresh/...` 验强制重抓

#### 8.4 Configs DSL 测试

`configs.dsl.util.spec.ts` 加 case：

- 嵌套 ZodObject 之 `meta.title` 提至 `field.subsection`
- 旧扁平 schema 不受影响

#### 8.5 Backfill job 测试

- 准备：插入若干旧 recently 行（带 metadata 各类型）
- 跑 `RecentlyEnrichmentBackfillJob.run()`
- 验：`enrichment_cache` upsert，recently 引用列填
- 二跑验幂等（marker 跳过）
- `inferProviderFromMetadata`、`convertLegacyMetadata` 之单元测试

#### 8.6 Recently 回归

- 创建 recently 仅传 url → 自动 enrichment 引用
- 读取 recently → 响应含 `enrichment` 字段
- 旧行（仅 metadata、无引用）→ 响应仍能拼 enrichment

#### 8.7 Yohaku 侧

- 各 `LinkCardRenderer.matches()` 之单元测试
- `fetchEnrichment` 之 mock 测试（disabled / token_missing / 正常）

#### 未覆盖（YAGNI）

- provider 之第三方真实集成测试（依赖外网 + token，CI 不跑）
- 性能/压测

## Migration Checklist

### Phase 1（本期 PR — mx-core）

- [ ] CREATE `enrichment_cache` 表（schema migration）
- [ ] ALTER `recently` 表加 `enrichment_provider`、`enrichment_external_id` 列与索引
- [ ] SQL migration 转 `thirdPartyServiceIntegration` 旧扁平 → 嵌套
- [ ] `ConfigsService.normalizeThirdParty()` 兼容层
- [ ] `enrichment` 模块（types、schema、repository、service、controller、registry）
- [ ] 8 类 provider 实现（github × 5、tmdb、bangumi、neodb、arxiv、leetcode、netease/qq、self）
- [ ] `configs.dsl.util.ts` 补 `field.subsection`
- [ ] `configs.schema.ts` 嵌套 schema 定义
- [ ] `data-jobs.registry.ts` + `RecentlyEnrichmentBackfillJob`
- [ ] `scripts/migrate.ts` 入口扩展
- [ ] recently service 写入/读取改造（新引用 + fallback 旧 metadata）
- [ ] `@mx-space/api-client` 出 `EnrichmentResult` 等类型

### Phase 1（本期 PR — Yohaku）

- [ ] 删反代 routes 与 `lib/github.ts`
- [ ] 新 `lib/enrichment.ts`
- [ ] plugin → renderer 改造（13 个）
- [ ] 删环境变量

### Phase 1（本期 PR — admin-vue3）

- [ ] 识别 `field.subsection` 渲染折叠面板/卡片

### Phase 2（下一 release）

- [ ] 删 `recently.metadata` 列（contract migration）
- [ ] 删 recently service 之 metadata fallback 分支
- [ ] 删 `ConfigsService.normalizeThirdParty()` 与旧字段提交兼容

## Risks & Open Questions

- **第三方 API quota**：cache-first 设计大幅减少调用，但首次抓取仍消耗。GitHub 个人 token 5000/h，TMDB 50/s — 通常足
- **Backfill 数据量**：recently 表通常不大；若实例规模大需评估 `pnpm migrate` 时长
- **inferProviderFromMetadata 准确率**：旧 metadata 形态若被 admin 手改可能反推失败，需打点统计 fallback 命中
- **admin-vue3 嵌套 section 渲染**：cross-repo 依赖；本期未验，需配套 PR
- **Self provider（mx-space）之 enrichment_cache**：内部内容理论上 cache 时长应短或基于事件失效（post 更新）— 暂用短 TTL（5min），事件失效后议
- **failureCount backoff 算法**：未在本 spec 详细定义；建议指数退避（2^n 分钟，封顶 24h），实现期再决

## References

- `apps/core/src/modules/configs/configs.schema.ts:401` — 既有 ThirdPartyServiceIntegrationSchema
- `apps/core/src/modules/configs/configs.dsl.util.ts:310` — extractField 嵌套对象处理
- `apps/web/src/components/ui/link-card/plugins/` — Yohaku 现有 plugin
- `docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md` — schema migration 模型参考
- `docs/superpowers/specs/2026-03-14-recently-typed-metadata-design.md` — recently metadata 既有设计
