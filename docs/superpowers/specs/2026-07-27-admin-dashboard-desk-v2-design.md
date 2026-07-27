# Admin Dashboard Desk v2 — Fill the First Screen

Date: 2026-07-27
Status: Approved
Builds on: `2026-07-27-admin-dashboard-redesign-design.md` (merged)

## Goal

The merged desk reads as empty on large screens: content hugs the top-left, the
rest is void. v2 fills the first screen with personal, low-noise elements — no
return to the old stat dump. Approved mockup: `.superpowers/brainstorm/57296-*/content/desk-full-v2.html`.

## Layout changes

- The desk content column is width-capped (`max-w-4xl`-class, ~880px) and centered;
  existing sections keep their order inside it.
- New page order: greeting header → **stat band** → two-column grid (left:
  继续写作, **那年今日**; right: 待办, **近期回声**) → **写作节律 heatmap** (full
  width) → slim footer (unchanged).
- Zen empty state rule is unchanged and still governs only 继续写作+待办; the new
  cards hide themselves independently when empty.

## New elements

### 1. Stat band

One flat row, six cells separated by hairlines (`bg-surface-card` container,
tabular-nums values), each a link:

| Cell | Value source (existing APIs) | Link |
|---|---|---|
| 今日访客 | `stat.todayIpAccessCount` (`getAggregateStat`) | `/insights` |
| 今日 UV | `stat.uv` | `/insights` |
| 文章 | `stat.posts` | `/posts` |
| 手记 | `stat.notes` | `/notes` |
| 评论 | `stat.allComments ?? stat.comments` | `/comments?state=1` |
| 总阅读 | `countReadAndLike().totalReads` | `/insights` |

No trend/deltas (no yesterday baseline exists — deliberately out of scope). The
band always renders; values default 0 while loading.

### 2. 近期回声 (right column, under 待办)

Source: existing `GET /activity/recent` (likes + comments + recent publishes).
Render up to 4 rows, newest first, mixing:

- comment rows: 💬 `<author> 评论了《<refTitle>》` + one-line excerpt + relative time
- like rows: ♥ `<n> 人赞了《<refTitle>》` (aggregate same-ref likes) + relative time

Own recent publishes from that endpoint are ignored. Card hidden when no rows.
Rows link to the referenced content's admin edit page when resolvable, else no-op.
The client must verify the actual response shape of `/activity/recent` and adapt
(it serves the public site today; if a field the design needs is absent, degrade
gracefully rather than extending the backend in this iteration).

### 3. 那年今日 (left column, under 继续写作)

New endpoint `GET /aggregate/on-this-day` (auth): published posts + notes whose
`created` matches today's month-day in any earlier year.

```ts
Array<{ id: string; type: 'post' | 'note'; title: string | null;
        created: string; excerpt: string }>
```

- `excerpt`: first ~80 chars of the plain `text`, server-trimmed.
- Ordered by year desc. Limit 5.
- UI (b2 style): featured card for the newest year — title + quoted excerpt +
  "N 年前的今天 · 文章/手记"; if more years exist, one meta line "还有 <years> 共
  M 篇", linking each entry to its editor. Card hidden when empty.

### 4. 写作节律 heatmap (full-width band above footer)

New endpoint `GET /aggregate/publish-heatmap` (auth): per-day published
post+note counts for the trailing 365 days.

```ts
Array<{ date: string; count: number }>   // days with count > 0 only
```

- UI: GitHub-style 52×7 grid (CSS grid, no chart lib), 4 intensity levels
  (0 / 1 / 2 / ≥3), accent-blue scale, native `title` tooltip "M月D日 · N 篇".
  Card header shows trailing-year total. Always renders.

## Data flow summary

New queries on the dashboard: on-this-day, publish-heatmap, activity-recent,
read-like (returning), joining desk/drafts/stat/appInfo/owner/update. All
one-shot (no polling) except the existing stat interval.

## Out of scope

- Trend deltas, "read peak" callouts, agent/command input, any new polling.
- Changes to insights, settings, or the existing desk endpoint.

## Verification

- core: e2e for the two new aggregate endpoints (seeded prior-year post/note for
  on-this-day incl. same-year negative row; seeded dated publishes for heatmap).
- admin: scoped typecheck/lint; one production build.
