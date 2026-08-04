# Admin Dashboard Desk v3 — Main + Rail

Date: 2026-08-04
Status: Approved
Builds on: `2026-07-27-admin-dashboard-desk-v2-design.md` (merged)

## Problem

On wide screens the v2 desk still reads as empty: the content column is capped at
`max-w-4xl` (~896px), and the two-column grid collapses to a single column whenever
the right side (待办 + 近期回声) has no data — which is the common steady state.
Three axes need fixing at once: container width, visual fill, and data richness.

## Goal

A main + rail layout (Vercel/Linear style) inside a wider container. The rail
carries always-on data modules so the desktop layout never collapses to one column.
Two new data cards raise information density without returning to the old stat dump.
Frontend-only: every data source already exists; no backend changes.

## Layout

- Container: `max-w-4xl` → `max-w-6xl` (~1152px), still centered.
- Page order: greeting → stat band (full width, unchanged) → main/rail grid →
  footer (unchanged).
- Grid: `desktop:grid-cols-[8fr_4fr]`, gap 4. Always two columns on desktop —
  the `hasLeftColumn`/`hasRightColumn` collapse logic in
  `DashboardRouteViewContent.tsx` is removed.
  - **Main (8fr):** 继续写作 (`DeskWritingCard`, hidden when empty) → zen empty
    state (same `showZen` rule as v2, rendered in the main column) → 那年今日
    (`DeskOnThisDayCard`, hidden when empty) → 写作节律 (`DeskRhythmCard`, always
    renders, moves from full-width band into the main column).
  - **Rail (4fr):** 待办 (`DeskTasksCard`, hidden when no tasks) → 近期回声
    (`DeskEchoCard`, hidden when empty) → 今日流量 (new, always renders) → 热门文章
    (new, hidden when empty).
- Neither column can be empty: main always has 写作节律, rail always has 今日流量.
- Below `desktop` breakpoint the grid stacks to one column in DOM order
  (main cards, then rail cards) — same as v2 behavior.

## New cards

### 1. 今日流量 — `DeskTrafficCard`

- Data: `getAnalyzeAggregate()` from `~/api/analyze` (existing `GET
  /analyze/aggregate`), using only the `today` series
  (`Array<{ hour, key: 'ip' | 'pv', value }>`).
- UI: 24-hour pv bar sparkline (pure SVG/CSS grid, no chart lib), accent-colored
  bars, missing hours filled with 0. Native `title` per bar: "HH:00 · N PV / M IP".
  Header shows card title + today total pv (sum of the series).
- Card links to `/analyze`. Always renders; zeroed bars while loading.

### 2. 热门文章 — `DeskTopArticlesCard`

- Data: `getTopArticles()` (existing `GET /aggregate/stat/top-articles`).
- UI: top 5 rows — rank, truncated title, reads count (tabular-nums). Each row
  links to the post editor (`/posts/edit?id=<id>`, the same route form
  `DeskOnThisDayCard.editPathFor` uses).
- Hidden when the list is empty.

## Data flow

Two new one-shot queries on the dashboard (`analyzeAggregate`, `topArticles`)
registered in `dashboardQueryKeys`, joining the existing desk/drafts/stat/
on-this-day/heatmap/activities/read-like set. No polling added. Query/card
failures degrade to the card's empty/hidden state; they do not join the
`DeskLoadError` retry surface (which stays scoped to desk + drafts).

## i18n

New keys under `dashboard.desk.traffic.*` and `dashboard.desk.topArticles.*`
added to every locale file.

## Out of scope

- Backend changes of any kind.
- Reworking the stat band into rich tiles (option C — rejected).
- Trend deltas, new polling, changes to insights.

## Verification

- Scoped typecheck + lint on changed files.
- One production build of `@mx-admin/admin`.
- Manual check at 1280px / 1536px / tablet / phone widths: two columns on
  desktop with both new cards, single column stack below desktop, zen state
  still appears when writing + tasks are empty.
