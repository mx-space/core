# Admin Dashboard Redesign — Task-Centric "Writing Desk"

Date: 2026-07-27
Status: Approved

## Goal

Replace the current data-dump dashboard (live cards + quick actions + 13 stat cells +
6 charts + maintenance cards) with a focused, task-centric view. The dashboard answers
two questions only: **what needs my attention** and **what was I writing**. Everything
else moves out.

## Decisions (from brainstorm)

- Task sources: unread comments, friend-link applications, unfinished drafts /
  scheduled notes, version updates (server + admin). Anomaly/error signals are out of
  scope (no backend detection infra; YAGNI).
- All stats and charts migrate off the dashboard (option "a"): content stats/charts go
  to a new Insights page; maintenance cards go to Settings.
- Layout: "Writing Desk" (option C from mockups, `.superpowers/brainstorm/48661-*/content/desk-v2.html`) —
  writing occupies the primary column, tasks the secondary column.
- A slim one-line footer keeps versions and live visitor numbers.

## Dashboard layout

`AppPage` shell, then:

1. **Greeting header** — time-of-day greeting + owner name, date line underneath.
   Right side: three quick-create buttons — 写文章 (`/posts/edit`), 写手记
   (`/notes/edit`), 速记 (`/recently?create=1`). 写文章 is the accent CTA; the others
   are subtle.
2. **Two-column body** (5fr / 3fr, stacking to one column on `tablet:`):
   - **继续写作 (left)** — up to 5 rows total: drafts first (by `updatedAt` desc),
     then scheduled notes (by `publicAt` asc):
     - Drafts from `GET /drafts` (`sort_by=updatedAt`, `size=5`), each row: type icon
       (post/note/page per `refType`), title (untitled fallback), meta "文章草稿 · N 天前".
       Click → the matching editor route for that draft.
     - Scheduled notes (`publicAt` in the future, `isPublished=true`) rendered with a
       clock icon and "定时 · <date> 发布". Click → note editor.
     - Empty → the card is omitted (zen state covers the whole body, see below).
   - **待办 (right)** — task rows, each deep-linking to the owning page:
     - 评论待审 · count → `/comments?state=0`, preview line: latest unread comment
       (author + excerpt).
     - 友链申请 · count → `/friends?state=1`, preview line: applicant name/url.
     - 版本更新 — one row per available update (server / admin), driven by the existing
       GitHub update query + `isNewerVersion`. Click → existing upgrade modal
       (`presentDashboardUpgrade`) or release modal (`presentUpdateRelease`).
     - Rows with zero count are omitted; card omitted when all are empty.
3. **Zen empty state** — when both columns are empty: single centered block (leaf
   glyph, "诸事已毕，可安心写作"), using the `EmptyState` inset styling.
4. **Slim footer** — one hairline-topped row, `text-xs text-fg-subtle`:
   left `server vX · admin vY` (+ 检查更新 action, existing refetch behavior), right
   `在线 N · 今日访客 N · 峰值 N`. Replaces `DashboardRuntimeFooter`'s card layout;
   upgrade modal and update toasts keep their current logic.

## Data flow

| Data | Source |
|---|---|
| Drafts | existing `GET /drafts` (`sort_by=updatedAt`, `size=5`) |
| Unread comments count + latest preview, link applications count + latest preview, scheduled notes | **new** `GET /aggregate/desk` (auth) |
| Online / today visitors / today max (footer) | existing `GET /aggregate/stat` (keep polling interval) |
| Version updates | existing client-side GitHub check (`checkUpdateFromGitHub`) |

### New endpoint — `GET /aggregate/desk`

Auth-only. Returns in one round trip:

```ts
{
  unreadComments: { count: number, latest: { id, author, text, refTitle } | null },
  linkApplications: { count: number, latest: { id, name, url } | null },
  scheduledNotes: Array<{ id, nid, title, publicAt }>
}
```

- `scheduledNotes`: `notes` where `isPublished = true` and `publicAt > now()`,
  ordered by `publicAt` asc, capped at 5.
- Implemented in `AggregateService` + `aggregate.controller.ts`, standard envelope,
  view schema in `aggregate.views.ts` per project conventions.
- The dashboard drops the current 12-query fan-out; remaining dashboard queries:
  desk, drafts, stat, appInfo, owner, github update.

## Insights page (new)

- Route `/insights`, view at `src/views/(intelligence)/insights/page.tsx`, feature code
  under `src/features/insights/`. Nav label 统计 (en: Insights), registered like the
  sibling `(intelligence)` views.
- Receives everything removed from the dashboard, unchanged in behavior:
  - Live row: online / today visitors / today max (`LiveCard`).
  - Stat grid: the 13 `StatCell`s (pages, categories, comments, unread, friends,
    applications, API calls, today IP, word count, reads, likes ×2, UV) with their
    existing deep links.
  - Charts: publication trend, category distribution, comment activity
    (`BarPanel`), `TrafficPanel`, `TopArticlesPanel`, `TagCloudPanel`.
- Components move from `features/dashboard/components/` to `features/insights/`;
  backend endpoints untouched. Query keys move with them.

## Maintenance → Settings

New static settings group 维护 (`maintenance`) appended to `staticGroupsAfter` in
`features/settings/constants.ts`, rendered by `SettingsDetailRoute` like `account` /
`meta-preset`. Contains the three existing actions with their current mutations and
confirm flow: clean API cache, clean Redis cache, rebuild search index
(incremental/force). `MaintenanceCard` + `SearchIndexRebuildCard` move under settings
feature code.

## Removals

- `features/dashboard/components/`: `ActionCard`, `StatCell`/`LiveCard`/
  `MaintenanceCard` (move or delete per above), `BarPanel`, `TagCloudPanel`,
  `TopArticlesPanel`, `TrafficPanel`, `SearchIndexRebuildCard`,
  `DashboardRuntimeFooter`, `OwnerLoginStat` (last-login info is available in
  settings/user context; dropped from dashboard).
- Dashboard refresh header button (desk queries are cheap; stat keeps its polling).
- Unused dashboard i18n keys removed; new keys added for desk/insights/maintenance
  (zh-CN + en-US).

## Testing & verification

- core: one e2e covering `/aggregate/desk` (seeded unread comment, audit link,
  scheduled note; auth required).
- admin: typecheck + lint scoped to changed files; one production build before
  completion.
- Update toast / upgrade modal logic is preserved as-is (no new tests).

## Out of scope

- Anomaly/error-signal tasks (option "e").
- Backend changes beyond the single `desk` endpoint.
- Nav-count badges, dashboard personalization, chart redesigns.
