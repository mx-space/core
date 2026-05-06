# Thinking Enrichment Unification + App Migration Framework

**Date**: 2026-05-06
**Status**: Approved
**Scope**: mx-core (`apps/core`, `packages/api-client`) + Yohaku (`apps/web`)
**Branch**: `feature/enrichment-module`

## Background

Yohaku 之 thinking page 渲染 url 走两条独立路径：

1. **markdown link-card**（既有）—— `MParagraph` 见单行 url 段落 → `BlockLinkRenderer` → `LinkCard` 拉客户端 plugin（GitHub API、Bangumi、TMDB 等实时 fetch）
2. **enrichment**（新立）—— core 之 enrichment module 缓存 normalized data，row 持 `enrichmentProvider` / `enrichmentExternalId` ref；admin 与 Yohaku 用 `EnrichmentCard` 渲

post-box V2 提交 url 入 content 与 metadata，故 markdown 把 content 内 url 段落自动卡片化（出 link-card）；同时 row 之 enrichment 又出 `EnrichmentCard` —— **二卡相叠**。

另：`EnrichmentCard` 之 layout 在 dark mode 下 host text 隐没，subtype badge 看似浮顶孤立。

DB 现存 92 行 recently，唯 2 行 attach enrichment ref；14 行单 url、26 行含 url（含混合文本）皆赖旧 markdown link-card 显示。

## Goals

1. thinking page 之 url 渲染**单一路径**：唯走 enrichment。markdown link-card 于 thinking variant 内禁
2. 旧数据**一次性回填**：扫所有无 ref 之 row，匹中 url → 写 ref + 落 cache
3. 立**app migration 框架**——schema 之外的「数据回填 / runtime transform」迁移机制，承此次回填，亦承未来同类
4. **修 EnrichmentCard layout**：subtype badge 紧贴 title；host 顶行 dark mode 可见

## Non-Goals

- markdown link-card 系统**不**全废——post / note 长文之 url 仍走旧路径（其他 `variant` 不受影响）
- 不做双写、灰度、feature flag——multi-instance deploy 之 race window 可接受
- 不做 schema 改动（除新加 `_app_migrations` ledger 表）—— `enrichmentProvider` / `enrichmentExternalId` 字段已存
- post-box（Yohaku 端）不再改——已 V2

## Architecture

### 数据流

```
[user 输入]
  ↓
post-box V2: textarea 检测首 url, 即时 /enrichment/resolve 预览
  ↓
POST /recently → core
  ↓
recently.service.create:
  matchUrlToRef(url) → { provider, externalId }
  写 row { enrichmentProvider, enrichmentExternalId, content, metadata.url }
  scheduleManager.schedule(() => resolve(url))  // 落 enrichment_cache
  ↓
GET /recently/* → core
  ↓
recently.service.{getAll,getOffset,findRecent,findById}:
  attachEnrichment(rows) → { ...row, enrichment: ResolvedResult | null }
  ↓
Yohaku thinking item:
  Markdown(content, disableBlockLink=true)   // 仅 inline 链接
  + EnrichmentCard(enrichment, failed=...)   // 唯一 row-level 卡
```

### 模块改动总览

| 仓 | 模块 | 性质 |
|---|---|---|
| mx-core | `database/schema/index.ts` | 加 `_app_migrations` 表 |
| mx-core | `database/migrations/NNNN_app_migrations_ledger.sql` | DDL |
| mx-core | `app-migrate.ts`（新） | runner |
| mx-core | `database/app-migrations/{registry,runner-utils}.ts`（新） | framework |
| mx-core | `database/app-migrations/20260506-enrichment-backfill.ts`（新） | 首条 |
| mx-core | `recently.repository.ts` | `findWithoutEnrichment()` |
| mx-core | `package.json` scripts | `migrate:app` / `migrate:all` |
| Yohaku | `markdown/Markdown.tsx`（路径待察） | 加 `disableBlockLink` prop |
| Yohaku | `markdown/renderers/paragraph.tsx` | 接 prop drill 之 `disableBlockLink` |
| Yohaku | `thinking/item.tsx` | 删 `BlockLinkRenderer` / `isSingleLinkContent`，唯 Markdown + EnrichmentCard |
| Yohaku | `thinking/enrichment-card.tsx` | L2 layout 重构（subtype 紧贴 title、host 去 opacity） |

## Detailed Design

### 1. App Migration Framework

#### 接口

```ts
// database/app-migrations/types.ts
import type { INestApplicationContext, Logger } from '@nestjs/common'

export interface AppMigration {
  id: string        // 'YYYYMMDD-slug', ledger 主键
  description: string
  up(ctx: { app: INestApplicationContext; logger: Logger }): Promise<void>
}
```

每条 migration **必须** idempotent —— 内部用 `WHERE ... IS NULL` 之类 guard 自检。runner 不为 row-level 幂等负责。

#### Ledger 表

```ts
// database/schema/app-migrations.ts
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'

export const appMigrations = pgTable('_app_migrations', {
  id: text('id').primaryKey(),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
  durationMs: integer('duration_ms'),
})
```

drizzle 自动生成对应 SQL DDL（落 `database/migrations/`）。

#### Registry

```ts
// database/app-migrations/registry.ts
import type { AppMigration } from './types'
import { migration as enrichmentBackfill } from './20260506-enrichment-backfill'

export const migrations: AppMigration[] = [
  enrichmentBackfill,
]
```

未来加新 migration 仅 `import + push`。

#### Runner

```ts
// apps/core/src/app-migrate.ts
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { withAdvisoryLock } from '~/processors/database/postgres.lock'
import { appMigrations as ledgerTable } from '~/database/schema'
import { migrations } from '~/database/app-migrations/registry'
import { PG_DB_TOKEN, PG_POOL_TOKEN } from '~/constants/system.constant'

const APP_MIGRATION_LOCK_KEY = /* unique BIGINT, ≠ schema lock */

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })
  const logger = new Logger('app-migrate')
  const db = app.get(PG_DB_TOKEN)
  const pool = app.get(PG_POOL_TOKEN)  // raw pg.Pool, 待察 token 名

  try {
    await withAdvisoryLock(pool, APP_MIGRATION_LOCK_KEY, async () => {
      const applied = new Set(
        (await db.select({ id: ledgerTable.id }).from(ledgerTable))
          .map((r: { id: string }) => r.id),
      )
      const sorted = [...migrations].sort((a, b) =>
        a.id.localeCompare(b.id),
      )
      for (const m of sorted) {
        if (applied.has(m.id)) {
          logger.log(`⊘ ${m.id} (already applied)`)
          continue
        }
        logger.log(`▶ ${m.id} — ${m.description}`)
        const start = Date.now()
        try {
          await m.up({ app, logger })
          const ms = Date.now() - start
          await db
            .insert(ledgerTable)
            .values({ id: m.id, durationMs: ms })
          logger.log(`✓ ${m.id} (${ms}ms)`)
        } catch (err) {
          logger.error(`✗ ${m.id}`, err)
          throw err  // 不 record，下次 redo
        }
      }
    })
  } finally {
    await app.close()
  }
}

main().catch((err) => {
  console.error('[app-migrate] failed:', err)
  process.exit(1)
})
```

**advisory lock**：`APP_MIGRATION_LOCK_KEY` 不同于 schema lock（确保二 runner 可并发或 schema 跑时 app data 不跑、反之亦然）。

**与 schema migration 之关系**：
- schema 永远先（DDL 必先就位）
- `migrate:all = migrate && migrate:app` 串行

#### CLI

```jsonc
// apps/core/package.json
"scripts": {
  "migrate": "tsx ... src/migrate.ts",                          // 既有
  "migrate:app": "tsx ... src/app-migrate.ts",                  // 新
  "migrate:all": "npm run migrate && npm run migrate:app",      // 新
  "predev": "npm run migrate:all"                               // 改：dev 自跑全
}
```

production deploy 之 release-phase 改跑 `migrate:all`。

### 2. Enrichment Backfill (首条 app migration)

```ts
// database/app-migrations/20260506-enrichment-backfill.ts
import type { AppMigration } from './types'
import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import { RecentlyRepository } from '~/modules/recently/recently.repository'

const URL_REGEX = /https?:\/\/\S+/i
const URL_TAIL_TRIM =
  /[!"'),.:;>?\]`}—…、。〉《》「」『』〕！），：；？]+$/

function extractFirstUrl(content: string | null | undefined): string | null {
  if (!content) return null
  const m = content.match(URL_REGEX)
  if (!m) return null
  let url = m[0]
  while (URL_TAIL_TRIM.test(url)) url = url.replace(URL_TAIL_TRIM, '')
  return url || null
}

export const migration: AppMigration = {
  id: '20260506-enrichment-backfill',
  description: 'Backfill enrichment refs for legacy recently rows',
  async up({ app, logger }) {
    const enrichmentService = app.get(EnrichmentService)
    const recentlyRepo = app.get(RecentlyRepository)

    const rows = await recentlyRepo.findWithoutEnrichment()
    let matched = 0
    let skipped = 0
    let resolveFailed = 0
    for (const row of rows) {
      const url =
        (row.metadata as { url?: string } | null)?.url ??
        extractFirstUrl(row.content)
      if (!url) {
        skipped++
        continue
      }
      const ref = enrichmentService.matchUrlToRef(url)
      if (!ref) {
        skipped++
        continue
      }
      await recentlyRepo.update(row.id, {
        enrichmentProvider: ref.provider,
        enrichmentExternalId: ref.externalId,
      })
      try {
        await enrichmentService.resolve(url)
      } catch (err) {
        // resolve 失败不致 migration 失败 — read 时会按需重试
        resolveFailed++
        logger.warn(
          `resolve failed for ${url}: ${(err as Error).message}`,
        )
      }
      matched++
    }
    logger.log(
      `backfill: total=${rows.length} matched=${matched} skipped=${skipped} resolveFailed=${resolveFailed}`,
    )
  },
}
```

#### Repository 新法

```ts
// recently.repository.ts
import { isNull } from 'drizzle-orm'

async findWithoutEnrichment(): Promise<RecentlyRow[]> {
  const rows = await this.db
    .select()
    .from(recentlies)
    .where(isNull(recentlies.enrichmentExternalId))
  return rows.map(mapRow)
}
```

#### 边界情形

- **content 内多 url**：仅取 first url（regex first match）；其他 url 之卡片化能力消失（仅 inline）。可接受。极端情形未来可加 `findAllUrls + first match`，但 single-row-single-card 之假设保持
- **metadata.url 与 content url 冲突**：`metadata.url` 优先（admin 输入路径之主源）
- **provider 不匹配**（如自家域、未实现 provider）：ref 留空，永远 inline 链接，无 card
- **resolve 失败**（token 缺、网络挂）：ref 写、cache 暂空。read 时 `attachEnrichment` 返 `enrichment: null`、`enrichmentExternalId: <set>`，UI 显 `<EnrichmentCard failed />` 占位

### 3. Markdown disableBlockLink Prop（D1a）

#### Markdown 主组件

```tsx
// 路径具体待察（apps/web/src/components/ui/markdown/Markdown.tsx 或类似）
interface MarkdownProps {
  // ...既有
  disableBlockLink?: boolean
}

// 内部 children components（如 MParagraph）通过 props.components 注入或 prop drill
// 既有 components 系统通常用 markdown-to-jsx 之 overrides
// 须把 disableBlockLink 传至 MParagraph
```

#### MParagraph

```tsx
// markdown/renderers/paragraph.tsx
export const MParagraph: FC<
  DetailedHTMLProps<...> & { disableBlockLink?: boolean }
> = (props) => {
  const { children, disableBlockLink, ...other } = props
  const { className, ...rest } = other

  if (React.Children.count(children) === 1) {
    const child = React.Children.toArray(children)[0]
    if (isImage(child)) return children
    if (isLink(child)) {
      const linkChildren = (child as any)?.props?.children
      if (disableBlockLink) {
        // 仅 inline 链接，不卡片化
        return (
          <p className={clsx('paragraph', className)} {...rest}>
            {child}
          </p>
        )
      }
      return (
        <BlockLinkRenderer href={(child as any)?.props?.href}>
          {linkChildren}
        </BlockLinkRenderer>
      )
    }
  }

  return (
    <p className={clsx('paragraph', className)} {...rest}>
      {children}
    </p>
  )
}
```

#### thinking item.tsx 用法

```tsx
<Markdown forceBlock variant="comment" disableBlockLink>
  {item.content}
</Markdown>
```

### 4. thinking item.tsx 渲染简化

```tsx
const hasEnrichmentRef = !!(item.enrichment || item.enrichmentExternalId)

return (
  <li ...>
    <header>{owner.name} <RelativeTime ... /></header>

    <div className="content-area ...">
      {item.content && (
        <Markdown forceBlock variant="comment" disableBlockLink>
          {item.content}
        </Markdown>
      )}
      {!!item.ref && <RefPreview refModel={item.ref} />}

      {hasEnrichmentRef && (
        <EnrichmentCard
          enrichment={item.enrichment}
          failed={!item.enrichment && !!item.enrichmentExternalId}
        />
      )}
    </div>

    <footer>{/* up/down/comment/edit/delete */}</footer>
    {/* seal 印章 m.div ... */}
  </li>
)
```

**删项**：`isSingleLinkContent` useMemo、`BlockLinkRenderer` import 与分支、`MarkdownContent` 包装。

### 5. EnrichmentCard L2 Layout 重构

#### Shell

```tsx
const CardShell: FC<{
  enrichment: EnrichmentResult
  styles: CategoryStyles
  children: ReactNode
}> = ({ enrichment, styles, children }) => {
  const url = enrichment.url
  const host = hostnameOf(url)
  const inner = (
    <>
      <span aria-hidden className={...rail} />
      <div className="relative py-3 pl-4 pr-3.5">
        {/* 顶行：仅 host，去 opacity */}
        <div
          className={clsxm(
            'mb-2 truncate font-mono text-[10px] uppercase tracking-[0.12em]',
            styles.accent,  // 已含 dark variant
          )}
        >
          {enrichment.category}
          {host && ` · ${host}`}
        </div>
        {children}
      </div>
    </>
  )
  // ...同既有
}
```

**关键改动**：
1. 删 `opacity-75`
2. 删 shell 内之 subtype badge（移入各 body）

#### TitleRow helper

```tsx
const TitleRow: FC<{
  title: ReactNode
  badge?: ReactNode
}> = ({ title, badge }) => (
  <div className="flex items-baseline gap-2">
    <Title>{title}</Title>
    {badge}
  </div>
)

const SubtypeBadge: FC<{ children: ReactNode; styles: CategoryStyles }> = ({
  children,
  styles,
}) => (
  <span
    className={clsxm(
      'shrink-0 border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.1em]',
      styles.badge,
    )}
  >
    {children}
  </span>
)
```

#### 各 body 之 badge

| body | badge 内容 | 备注 |
|---|---|---|
| GithubBody | subtype（repo/issue/pr/commit/discussion） + 可选 state（open/closed/merged） | state 用第二个独立 badge |
| MediaBody | subtype（movie/tv/anime） | |
| BookBody | 无（subtype `book` 与 category 重复） | |
| MusicBody | subtype（song/album） | |
| AcademicBody | 无 badge；arxivId 仍以 mono 小字另显 | |
| CodeBody | difficulty（已有，移入 TitleRow） | |
| SelfBody | 无 | |

各 body 改为：
```tsx
const GithubBody: FC<{ enrichment: EnrichmentResult }> = ({ enrichment }) => {
  const styles = stylesOf(enrichment.category)
  const subtype = enrichment.subtype
  const state = findAttr(enrichment, 'state')?.value
  // ...
  return (
    <div className="min-w-0">
      <TitleRow
        title={enrichment.title}
        badge={
          <>
            {subtype && (
              <SubtypeBadge styles={styles}>{subtype}</SubtypeBadge>
            )}
            {state && (
              <SubtypeBadge styles={styles}>{String(state)}</SubtypeBadge>
            )}
          </>
        }
      />
      <Description>{enrichment.description}</Description>
      {/* meta 行 */}
    </div>
  )
}
```

#### 视觉示例

```
github · github.com                          ← 顶行 mute
facebook/react-native  [REPO]                ← title + subtype
A framework for building...                  ← desc
● C++   ★ 125,747   ⑂ 25,148                ← meta
```

## Verification

**手动核验**（一次性 migration 无需自动 e2e）：

1. **clean run**
   - drop `_app_migrations` 表（dev 库）
   - `npm run migrate:all`
   - 验：
     - `_app_migrations` 表存在并含 `20260506-enrichment-backfill` 记录
     - `recentlies` 中 themoviedb / github / arxiv / bgm 之 row 之 `enrichment_provider` 与 `enrichment_external_id` 已写
     - `enrichment_cache` 中相应 row 已落（缺 token 之 provider 之 row 之 cache 暂空，UI 显失败 placeholder）
2. **idempotent**
   - 再跑一遍 `migrate:all` —— 应 noop（ledger hit），不重写 row
3. **Yohaku UI 抽查**
   - 旧 themoviedb / github 类 row → EnrichmentCard，layout 同 §5 之示例
   - 纯文本 row → 仅文字
   - 自家域名 row（如 `gallery.innei.in`）→ inline 链接，无 card
   - 多 url row → first url 之 enrichment + 其他 url 之 inline 链接

**unit test**：
- `extractFirstUrl` helper 加 vitest unit test（trailing 标点处理、CJK 标点边界、no-url、empty）

## Open Questions

- **PG_POOL_TOKEN**：runner 内 `withAdvisoryLock` 需 raw `pg.Pool`。须察既有 NestJS DI token 之命名（`PG_DB_TOKEN` 提供 drizzle，pool 是 underlying）
- **Markdown 主组件之具体路径与 prop 透传机制**：实施前先察 Yohaku 之 markdown 主组件入口，确认 prop 可透传至 `MParagraph`（markdown-to-jsx 之 `overrides`、自家 component map 等）

二项实施时即刻察清，不立 blocker。

## Out of Scope (Future Work)

- enrichment 之 self-domain provider（自家域 url 之 first-class enrichment）
- thinking row 之多 enrichment 支持（schema 改 array 字段）
- 老 markdown link-card 系统之 plugin（gh-repo / bangumi 等）于 post / note 内之去重 / 与 enrichment 共用 cache
