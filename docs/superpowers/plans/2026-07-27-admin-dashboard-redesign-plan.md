# Admin Dashboard Redesign — Implementation Plan

Spec: `docs/superpowers/specs/2026-07-27-admin-dashboard-redesign-design.md` (approved).
Monorepo: backend `apps/core` (NestJS + Drizzle), admin SPA `apps/admin` (React 19,
TanStack Query, Tailwind v4 tokens).

## Global Constraints

- **Zero code comments, zero JSDoc.** No section headers, no "what" comments. Only
  document a workaround or hidden invariant, and only if omission would confuse.
- **Core API rules:** controllers return bare values (global interceptor wraps
  `{ data }`); never return a literal with a top-level `data` key; errors via
  `BizException`/`AppException` subclasses; field selection via `*.views.ts` Zod
  schemas parsed at the controller layer; code camelCase end to end (wire snake_case
  conversion is automatic); routes need `@Auth()` for admin-only access.
- **Admin styling:** semantic tokens only (`bg-surface-*`, `text-fg*`, `border-border*`,
  `accent*`); `neutral-*` never `gray-*`; no arbitrary font sizes (`text-[13px]`
  forbidden — use `text-xs`…`text-2xl` per CLAUDE.md table); radii/shadow scales from
  tokens; focus ring `focus-visible:outline-hidden focus-visible:ring-[3px]
  focus-visible:ring-accent/15`.
- **i18n:** every user-visible string via `useI18n()` keys added to BOTH
  `apps/admin/src/i18n/resources/zh-CN.ts` and `en-US.ts`.
- **Verification scope:** lint/typecheck only changed files
  (`pnpm -C apps/admin exec tsc --noEmit --pretty false` for admin; scoped eslint).
  Never lint/build the whole tree except the single admin production build in Task 4.
- Max 500 lines per file; React components under 300 lines.
- Commit per task; no AI co-authorship lines.

## Task 1: `GET /aggregate/desk` endpoint (core)

**Goal:** one auth-only endpoint returning everything the new dashboard's 待办 column
needs in a single round trip.

**Files:** `apps/core/src/modules/aggregate/` (`aggregate.controller.ts`,
`aggregate.service.ts`, plus the module's views/schema file following its existing
pattern). One e2e test alongside the module's existing tests.

**Response shape (camelCase, controller returns bare object — no envelope literal):**

```ts
{
  unreadComments: {
    count: number
    latest: { id: string; author: string; text: string; refTitle: string | null } | null
  }
  linkApplications: {
    count: number
    latest: { id: string; name: string; url: string } | null
  }
  scheduledNotes: Array<{ id: string; nid: number; title: string | null; publicAt: string }>
}
```

**Requirements:**
- Route `GET /aggregate/desk`, `@Auth()` protected.
- `unreadComments`: comments in the unread state (the state the admin lists via
  `/comments?state=0`; check the comment state enum in the comment module). `latest` =
  newest unread comment; `refTitle` = title of the post/note/page the comment belongs
  to (null if unresolvable). Excerpt `text` server-side is NOT required — return full
  text; the client truncates.
- `linkApplications`: links in audit state (admin lists via `/friends?state=1`; check
  the link state enum). `latest` = newest applicant.
- `scheduledNotes`: notes where `isPublished = true` AND `publicAt > now()`, ordered
  `publicAt` asc, limit 5.
- Follow the aggregate module's existing service/controller/view conventions (look at
  how `stat` is implemented). Reuse existing repositories.
- Snowflake ids serialize as strings at the boundary (existing convention — follow
  whatever the module already does).

**Verification:** one e2e covering the endpoint: seed one unread comment on a post,
one audit-state link, one future-`publicAt` note + one past-`publicAt` note; assert
counts, `latest` fields, scheduled list contents and that auth is required (401/403
without credentials). The repo has a `create-e2e-test` skill — invoke it to get the
`createE2EApp` testcontainer patterns before writing the test. Run only this test
file, then scoped typecheck/lint on changed files.

## Task 2: Insights page (admin) — move stats & charts off the dashboard

**Goal:** new 统计 page at `/insights` in the `(intelligence)` group receiving the
dashboard's live cards, stat grid, and charts unchanged; dashboard drops those
sections (it keeps quick actions + maintenance + footer until Tasks 3–4).

**Files:**
- New `apps/admin/src/views/(intelligence)/insights/page.tsx` (follow the sibling
  `analyze/page.tsx` + the group's `meta.ts` registration pattern so it appears in nav).
- New `apps/admin/src/features/insights/` — components moved from
  `apps/admin/src/features/dashboard/components/`: `DashboardPrimitives.tsx`'s
  `LiveCard`/`StatCell` (move; `MaintenanceCard` stays behind for now), `BarPanel.tsx`,
  `TrafficPanel.tsx`, `TopArticlesPanel.tsx`, `TagCloudPanel.tsx`, plus the query
  keys/constants those panels need (from `features/dashboard/constants.ts`).
- Edit `features/dashboard/components/DashboardRouteViewContent.tsx`: remove the live
  card row, the 13-cell stat `Panel`, and the six-chart section plus their now-unused
  queries/imports (`wordCount`, `readLike`, `siteLike`, `category`, `trend`, `tags`,
  `topArticles`, `commentActivity`, `trafficSource`). Keep `stat` query (still used by
  quick actions), maintenance panel, `OwnerLoginStat`, footer, update toasts.

**Page composition (all behavior unchanged from the old dashboard):**
1. Live row: online / today visitors / today max (`LiveCard`s, aggregate stat query
   with its existing `refetchInterval`).
2. Stat grid: the 13 `StatCell`s with their existing values, icons, and deep links
   (pages, categories, all comments, unread comments, friends, friend applications,
   API calls, today IP, word count, total reads, post likes, site likes, UV).
3. Charts: publication trend / category distribution / comment activity (`BarPanel`),
   `TrafficPanel`, `TopArticlesPanel`, `TagCloudPanel`.

**i18n:** nav + page title keys (`insights.*`): zh 统计, en Insights. Stat/chart labels
keep their existing `dashboard.*` keys for now (Task 4 renames/cleans).

**Verification:** scoped typecheck + lint on changed files. App must compile with the
dashboard in its intermediate (slimmed) state.

## Task 3: Maintenance settings group (admin)

**Goal:** the three maintenance actions live in Settings; dashboard drops its
maintenance panel.

**Files:**
- `apps/admin/src/features/settings/constants.ts`: append static group `maintenance`
  to `staticGroupsAfter` (icon: a lucide wrench/brush icon consistent with siblings).
- `apps/admin/src/features/settings/components/`: new section component rendered by
  `SettingsDetailRoute` for the `maintenance` type (follow how `account` /
  `meta-preset` static sections are wired). Move `SearchIndexRebuildCard` from
  `features/dashboard/components/` and the `MaintenanceCard` primitive out of
  `DashboardPrimitives.tsx` into the settings feature.
- The three actions keep their exact current behavior: clean API cache
  (`cleanCache`), clean data cache (`cleanRedis`), rebuild search index
  (incremental + force with `window.confirm`), including toasts and the
  search-index query invalidation.
- Edit `DashboardRouteViewContent.tsx`: remove the maintenance `Panel`, its three
  mutations, and now-unused imports.

**i18n:** settings group title/description keys (`settings.group.maintenance.*`),
zh 维护. Card labels may reuse existing `dashboard.maintenance.*` keys for now
(Task 4 cleans up) or move to `settings.maintenance.*` — mover's choice, both locales.

**Verification:** scoped typecheck + lint on changed files.

## Task 4: Dashboard rewrite — Writing Desk (admin)

**Goal:** replace the remaining dashboard with the approved desk layout.

**Files:**
- Rewrite `apps/admin/src/features/dashboard/components/DashboardRouteViewContent.tsx`
  (keep the file/route name); new small components in the same directory as needed
  (each under 300 lines).
- New API client fn in `apps/admin/src/api/aggregate.ts`: `getDesk()` →
  `GET /aggregate/desk` (Task 1 shape).
- Delete now-dead files: `ActionCard.tsx`, `DashboardPrimitives.tsx` (whatever
  remains), `DashboardRuntimeFooter.tsx`, `OwnerLoginStat.tsx`, and any orphaned
  constants/utils. `DashboardUpgradeModal.tsx` + `UpdateReleaseModal.tsx` stay.
- i18n: new `dashboard.*` keys for the desk; delete keys no longer referenced
  anywhere (grep before deleting — Tasks 2–3 may still use some `dashboard.*` keys;
  rename those to their new homes and update usages so the `dashboard.*` namespace
  ends up desk-only).

**Layout (spec §Dashboard layout):**
1. **Greeting header** — time-of-day greeting (morning/afternoon/evening variants) +
   owner name (existing `getOwner` query), date line under it. Right: three
   quick-create buttons — 写文章 → `/posts/edit` (accent CTA), 写手记 → `/notes/edit`
   (subtle), 速记 → `/recently?create=1` (subtle). No page refresh button.
2. **Two-column body** — `5fr/3fr` grid, single column on `tablet:`:
   - 继续写作 card: up to 5 rows total — drafts from existing `getDrafts` API
     (`sort_by: 'updatedAt'`, `sort_order: 'desc'`, `size: 5`) first, then
     `scheduledNotes` from desk endpoint (by `publicAt` asc), truncated to 5 combined.
     Draft row: refType icon (post/note/page), title (untitled fallback key), meta
     "文章草稿 · N 天前"-style relative time; click → that draft's editor route
     (check how `features/drafts` builds edit links). Scheduled row: clock icon,
     "定时 · <date> 发布" meta; click → note editor.
   - 待办 card: rows with count badge + one-line preview, each deep-linking:
     评论待审 → `/comments?state=0` (preview: latest author + text excerpt, CSS
     truncation); 友链申请 → `/friends?state=1` (preview: name/url); version rows —
     server update → `presentUpdateRelease`, admin update → `presentDashboardUpgrade`,
     shown only when `isNewerVersion` says newer (reuse the existing github update
     query + logic). Zero-count rows omitted; whole card omitted when empty.
3. **Zen empty state** — both columns empty → single centered inset block (leaf glyph
   + "诸事已毕，可安心写作" key), no cards.
4. **Slim footer** — one `border-t` hairline row, `text-xs text-fg-subtle`:
   left `server vX · admin vY` + a 检查更新 text action (existing refetch behavior +
   upgrade modal entry points preserved); right `在线 N · 今日访客 N · 峰值 N` from
   the existing aggregate stat query (keep its polling). The demo-mode toast and the
   update-available toasts (with their localStorage closed-tip logic) are preserved.

**Data:** queries = desk (`getDesk`), drafts, aggregate stat, appInfo, owner, github
update. The old 12-query fan-out must be gone.

**Verification:** scoped typecheck + lint on changed files; grep proves deleted i18n
keys and deleted components have zero remaining references; then ONE admin production
build (`pnpm --filter @mx-admin/admin run build`) must pass.

## Task 5: Final verification sweep

**Goal:** prove the branch is coherent end to end.

- `rg` for any remaining references to deleted components/keys across `apps/admin`.
- Run the Task 1 e2e test file once more.
- Admin production build if Task 4's build did not already run on the final code.
- Fix only what these checks surface; no new features.
