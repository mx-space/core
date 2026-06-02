# Admin `/comments` Redesign — Design

**Date:** 2026-06-02
**Scope:** `apps/admin` `/comments` route (list + detail), plus required backend additions in `apps/core` `comment` module.
**Authors:** Innei + brainstorming session.

## 1. Motivation

The current `/comments` page is a serviceable master-detail surface (filter dropdown, rich list rows, threaded detail, bottom-anchored reply composer), but it does not adequately serve the mixed daily workflow the owner actually performs:

- **Triage** — fast scanning of unread, bulk mark / junk / delete.
- **Engage** — read the surrounding thread, reply to a specific commenter.
- **Moderate** — investigate identity, IP, history; spot spam patterns.

Pain points motivating the redesign:

- State navigation is buried in a dropdown — counts are invisible, the "what's left to do" inbox feel is missing.
- The list row hides the parent quote and source context the reviewer needs to decide quickly.
- The detail pane has no aggregated view of the author's activity / origin / threat signal — every moderation action requires a context switch.
- The visual register predates Design System v2 (Notion-warm surfaces, cobalt accent, soft 3px focus rings, larger radii).
- Keyboard support is per-row only; there is no overview of shortcuts, no "Done & next" workflow, no tab jumps.

## 2. Goals

1. Surface state navigation with counts as the primary chrome (Gmail-style tabs).
2. Show enough per-row context (identity, parent quote, origin, thread size) that the reviewer can decide without opening detail.
3. Aggregate identity, origin, activity, and a coarse threat signal alongside the threaded conversation in the detail pane.
4. Adopt Design System v2 tokens end-to-end (surface stack, fg, accent cobalt, radii 8/10/12, soft focus).
5. Add a "Done & next" triage workflow with discoverable shortcuts (`?` overlay) without coupling generic list-keyboard infrastructure to comments business logic.
6. Extend the backend with the minimum endpoints needed (tab counts, author activity, country enrichment) — no soft fallbacks.

### Non-goals

- Offline mutation queue (out of scope; current behavior is fail-fast on network errors).
- Visual regression / screenshot testing harness.
- "Saved searches" / persisted view configurations.
- Replacing the existing `MasterDetailShell` or focus-scope primitives.

## 3. User decisions captured

| Question | Decision |
| --- | --- |
| Why redesign? | A+B+C+D — density, visual, workflow, IA all matter |
| Primary use? | Mixed — triage + engage + moderate |
| Layout paradigm | **A · Inbox tabs** (state as top tabs with counts, master-detail beneath) |
| Tabs | **D · All six** — Unread, Awaiting, Whispers, Read, Junk, All |
| List row density | **R3 · Rich** (~110px; identity, parent quote, IP+country, device, thread count) |
| Detail pane | **D2 · Focus + meta sidebar** (parent quote, spotlight card, sibling thread, right rail Identity/Origin/Activity/Threat-signal) |
| Backend scope | **B · Frontend + necessary backend** (extend API where required) |
| Workflow | **C · New-first default + "Done & next" via ⌥E + ? shortcut overlay** |

## 4. Information architecture

### 4.1 Tabs (`?tab=` URL state)

Six tabs, with counts, in this order:

```
Unread · 42   Awaiting · 8   Whispers · 2   Read   Junk · 3   All
```

- "Awaiting" is server-computed: `state != Junk && !is_deleted && owner has not replied to this thread later than the thread's latest activity` (see §6.1).
- A count of zero is rendered without a badge (just the label).
- Counts > 99 render as `99+`.
- Old `?state=0|1|2` is honored as a deprecated alias for one release (response carries `Deprecation: true`).

### 4.2 Filter strip

Beneath the tabs:

```
[All sources]  [post]  [note]  [page]    On "Why I left Notion" ×    238 of 980
```

- `refType` chips remain as a quick filter.
- Source combobox renders as a removable chip when active.
- Total count on the right is `pagination.total` for the current tab+filter combination.

### 4.3 Selection bar

When `selection.size > 0`, the filter strip is replaced by:

```
☑ 12 selected   Select all 238 on this page →     ✓ Mark read   ⚠ Junk   🗑 Delete   ⨯ Clear
```

- Cross-page "Select all N" sets `selectAllMode = true` (existing behavior).
- Bulk actions reuse `batchStateMutation` and `batchDeleteMutation`.

## 5. Component map

```
features/comments/components/
├── CommentsRouteViewContent.tsx       (orchestrator)
├── TopBar.tsx                         NEW — tabs + search + density menu
├── FilterStrip.tsx                    NEW — ref-type chips + source chip
├── SelectionBar.tsx                   NEW — bulk actions (replaces FilterStrip when selected)
├── CommentListItem.tsx                CHANGED — upgraded to R3
├── CommentDetail.tsx                  CHANGED — splits into…
│   ├── DetailHeader.tsx               NEW
│   ├── ThreadColumn.tsx               NEW — parent quote, spotlight, siblings
│   ├── MetaSidebar.tsx                NEW — identity / origin / activity / threat
│   └── ReplyComposer.tsx              NEW — composer with @ mention + ** bold
├── CommentDetailEmpty.tsx             (unchanged)
└── CommentPrimitives.tsx              EXTEND — keep Avatar / MetaItem / EmojiPopover

features/comments/hooks/
├── use-comments-list.ts               EXTEND — accept tab + author
├── use-comment-mutations.ts           EXTEND — markAndAdvance helper
├── use-comment-tab-counts.ts          NEW
├── use-author-activity.ts             NEW
└── use-comment-route-shortcuts.ts     NEW — tab jumps, /, r (composer)

features/comments/utils/
└── country-flag.ts                    NEW — ISO-3166 alpha-2 → flag emoji
```

App-shell additions:

```
ui/keyboard-shortcut-overlay/
├── KeyboardShortcutsProvider.tsx      NEW
├── useRegisterShortcuts.ts            NEW
└── ShortcutOverlay.tsx                NEW — backdrop + grouped card, toggled by ?
```

Generic list infrastructure:

```
ui/list-actions/useListKeyboard.ts     EXTEND — add Shift+ArrowDown / Shift+ArrowUp / Shift+j / Shift+k range-select to defaultExtras
```

## 6. Backend extensions

All new server work lives under `apps/core/src/modules/comment/`.

### 6.1 `GET /api/comment/tab-counts`

Single round trip for the six tab badges.

```
query:    refType?, refId?
response: { data: { unread, read, junk, whispers, awaiting, all } }
```

Service: `commentService.getTabCounts(filter)` issues a single SQL with `COUNT(*) FILTER (WHERE …)` clauses:

```sql
SELECT
  COUNT(*) FILTER (WHERE state = 0 AND NOT is_deleted)        AS unread,
  COUNT(*) FILTER (WHERE state = 1 AND NOT is_deleted)        AS read,
  COUNT(*) FILTER (WHERE state = 2)                            AS junk,
  COUNT(*) FILTER (WHERE is_whispers AND NOT is_deleted)       AS whispers,
  COUNT(*) FILTER (
    WHERE state != 2 AND NOT is_deleted AND NOT EXISTS (
      SELECT 1 FROM comments owner_reply
      WHERE owner_reply.root_comment_id = c.root_comment_id
        AND owner_reply.is_owner_reply = TRUE
        AND owner_reply.created_at > c.created_at
    )
  )                                                            AS awaiting,
  COUNT(*) FILTER (WHERE NOT is_deleted)                       AS all
FROM comments c
WHERE ($1::text  IS NULL OR ref_type = $1)
  AND ($2::bigint IS NULL OR ref_id  = $2);
```

- Cache: Redis 30s, key `comment:tab-counts:{refType ?? '*'}:{refId ?? '*'}`. Invalidated on any mutation in the comment service that changes state, is_deleted, or is_whispers.
- A new column `is_owner_reply BOOLEAN NOT NULL DEFAULT FALSE` is required (see §6.5).

### 6.2 `GET /api/comment/list` extensions

- Add `tab=unread|read|junk|whispers|awaiting|all` parameter. Internally translates to the same predicates used in §6.1.
- Keep `state=0|1|2` as alias for one release; emit `Deprecation: true` response header. If both `tab` and `state` are present, `tab` wins (the deprecated parameter never overrides the new one).
- Add `author=<mail|ip>` parameter — restricts results to comments authored by that mail or originating from that IP.
- Add `countryCode?: 'CN' | 'US' | …` field to each row, populated by `enrichCommentsWithCountry` (see §6.4).
- Response shape is unchanged otherwise; the `parentPreview` (existing) is leveraged for the row's quote line.

### 6.3 `GET /api/comment/author-activity`

Data source for the detail pane's sidebar.

```
query:    { mail?: string, ip?: string, limit?: number = 5 }
          (at least one of mail / ip is required — otherwise 400 VALIDATION_FAILED)

response: {
  data: {
    totalCount: number,
    firstSeenAt: string,
    lastSeenAt: string,
    items: Array<{
      id, createdAt, refType, refTitle, refLink, textExcerpt, state,
    }>,
    threatLevel: 'trusted' | 'neutral' | 'risk',
    threatReason?: string,
  }
}
```

Threat computation:

- `trusted` — within the last 30 days, no junk-flagged comment AND `totalCount >= 3`.
- `risk` — author has been junk-flagged before, OR same `/24` IP block has `>=3` junk in the last 7 days.
- otherwise `neutral`.

Cache: Redis 5min, key `comment:author-activity:{mail ?? ''}:{ip ?? ''}`.

### 6.4 Country enrichment

- Service method `enrichCommentsWithCountry(comments)` — collects unique IPs, resolves via the existing built-in `ip` function (already used by `IpInfoPopover`), with `cf-ipcountry` header as a server-edge fallback.
- Per-IP cache: Redis `geoip:{ip}` TTL 30 days.
- `country_code` is also persisted on the `comments` row at write time (see §6.5) so subsequent reads do not require lookup.

### 6.5 Schema migration (expand-contract)

Two new columns on `comments`, both backward-compatible:

```sql
ALTER TABLE comments ADD COLUMN is_owner_reply BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN country_code   TEXT;
```

- `is_owner_reply` is set by the reply mutation when the actor is the owner (Better Auth session matched to `getOwner()`).
- `country_code` is set at insert time by the enrichment service; null is permitted to allow lazy backfill on read.
- Backfill scripts:
  - `scripts/backfill-owner-reply.ts` — flag historical owner-authored replies (idempotent, batches of 1000).
  - `scripts/backfill-country.ts` — populate `country_code` from existing `ip` values via the builtin lookup (idempotent).

This follows the project's `mx-migration-author` skill conventions (expand → backfill → read-from-new across separate PRs — see §10).

## 7. Frontend behavior

### 7.1 Top bar

- `role="tablist"`. Active tab has `border-b-2 border-accent`, `text-fg`, `font-semibold`.
- Counts render as a pill: `bg-surface-inset text-fg-muted` (active: `bg-accent-soft text-accent`).
- Search icon expands to an inline input on click (or `/` keypress); 300ms debounce; bound to `?search=`.
- The `⋯` menu contains:
  - Density: `Compact` / `Cozy` / `Rich` (default Rich, stored in `localStorage:comments.density`).
  - "Show shortcuts (?)".
  - "Refresh" (re-runs the list query).

### 7.2 List row (R3)

Layout (desktop, Rich):

```
[☐] [avatar32] Alice  alice@example.com  [edited]                       2h
                ┃ ↳ replying to Bob: Thanks for sharing this perspect…
                Great post — really enjoyed reading it. Could you elaborate
                on the second point about second-order effects?
                On "Why I left Notion" · 🇨🇳 1.2.3.4 · Chrome · macOS · 3 in thread
```

Rules:

- **Identity line:** prefer `mail`, fall back to `url`, otherwise the literal `anonymous` chip. Identity text uses `text-fg-subtle` 11px.
- **Badges** (`rounded-full` pills):
  - `edited` — `bg-surface-inset text-fg-muted`, when `editedAt` is present.
  - `whispers` — `bg-amber-100 text-amber-800` (dark equivalents).
  - `junk auto-flagged` — `bg-red-100 text-red-700` (rendered only in the Junk tab to avoid redundancy on its own tab).
  - `pinned` — `bg-green-100 text-green-700`.
  - `↳ to <owner-name>` — `bg-accent-soft text-accent`, when `parent.author === owner`.
- **Parent quote line**: renders when `parentPreview` is present and not soft-deleted; excerpt clamps to 30 chars. Visibility is governed by the density toggle below (hidden in Compact, shown in Cozy and Rich).
- **Body:** `text-fg`, 2-line `line-clamp`.
- **Meta row:** ref title (clickable — sets `?refType=&refId=`), country flag + IP, UA summary (compact format from `getDeviceInfo`), `N in thread` count.

Density toggle (`Compact` / `Cozy` / `Rich`):

| Element | Compact | Cozy | Rich |
| --- | --- | --- | --- |
| Identity line | hidden | hidden | shown |
| Parent quote | hidden | shown | shown |
| Body line-clamp | 1 | 2 | 2 |
| Country flag | shown | shown | shown |
| IP value | hidden | hidden | shown |
| UA summary | hidden | hidden | shown |
| Thread count | hidden | shown | shown |

Country flag emoji is rendered via `~/utils/country-flag.ts`. When `countryCode` is absent, render `🏳️` in `text-fg-subtle`.

### 7.3 Detail pane

**Header** (48px):

```
[← back-mobile]  Alice Chen · on "Why I left Notion" · post
                                            [✓ Mark read ⌥E] [⚠ Junk ⌥J] [🗑 ⌫]
```

- Author 14px semibold; crumb 12px muted; ref title is a link to the public-facing URL (new tab).
- Action buttons reuse `btn-sm`. Shortcut hints render as `text-fg-subtle` 11px immediately after the label.

**Body** is a grid `1fr 220px` on desktop, single column on mobile.

**Thread column:**

1. **Parent quote** — `border-l-2 border-border-strong px-3 py-1 text-fg-muted`. Clicking the parent scrolls to its position within the full thread render.
2. **Spotlight card** — current comment:
   - `bg-card border border-accent rounded-md` with a `0 0 0 4px rgba(47,92,255,.08)` glow.
   - 28px avatar, author + `edited` badge, time + original-post time when edited.
   - Body uses `MarkdownRender` (existing).
3. **Siblings** — labeled `THREAD · N more`. Owner replies use `border-l-accent`; others use `border-l-border`. Default shows three most-recent items; remainder is "Show N hidden replies" disclosure.
4. **Local replies** — existing `localReplies` continues to be appended below siblings with a "just sent" hint.

**Meta sidebar** (220px on desktop; collapsible disclosure on mobile):

```
IDENTITY        ORIGIN              ACTIVITY BY ALICE         THREAT SIGNAL
✉ alice@…      📍 🇨🇳 Shanghai     ● Current (this · 2h)    ● Trusted · 30d clean
🌐 alice.dev↗   🌐 1.2.3.4           ○ Reply on … · 6d
# 8231         💻 Chrome / macOS    ○ Reply on … · 30d
                                    View all 7 →
```

- **Identity** — mail and url are anchor links; `# id` is copyable. If both mail and url are absent, render `Anonymous`.
- **Origin** — wraps `IpInfoPopover` (existing) as the trigger for the country / city / ISP detail.
- **Activity** — uses `useAuthorActivity({ mail, ip })`. The "View all N →" link navigates to `/comments?author=<mail | ip>` (the new query parameter from §6.2).
- **Threat signal** — three states with semantic color (`text-green-700` / `text-fg-muted` / `text-red-700`), optionally with the `threatReason` as a smaller line below.

**Composer** (only when `state !== Junk && !isDeleted`):

- Wrapper: `rounded-lg border border-border focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15`.
- Tools row: `EmojiPopover` (existing), `@` mention (autocomplete from thread participants), `**` bold markdown shortcut, `⌘↵` hint, primary `Send`.
- Submit → toast + push to `localReplies` (existing). `esc` clears + blurs.

## 8. Keyboard model

### 8.1 Three-layer scoping (no coupling)

| Layer | Lives in | Concerns | Coupling to comments |
| --- | --- | --- | --- |
| L1 generic list | `ui/list-actions/useListKeyboard.ts` `defaultExtras` | `$mod+a`, `Escape`, `Space`, **new** `Shift+ArrowDown / Shift+ArrowUp / Shift+j / Shift+k` (range-select) | **none** — applies to every list |
| L2 feature actions | `features/comments/components/buildCommentActions.ts` (extended) | `e`, `s`, `⌫`, `⌥e`, `⌥s` — passed in via `ListAction<CommentModel>.shortcut` | hook does not know action semantics |
| L3 route shortcuts | `features/comments/hooks/use-comment-route-shortcuts.ts` | `g u / g r / g j / g w / g a / g l`, `/`, `r` | calls `tinykeys(window, …)` directly; lives outside the hook |

### 8.2 L1 change (one place)

Append to `useListKeyboard.ts` `defaultExtras`:

```ts
const advanceRange = (dir: 1 | -1) => (event: KeyboardEvent) => {
  const items = itemsRef.current
  const getId = getIdRef.current
  const cursor = patchedSelection.cursorId
  const idx = items.findIndex((it) => getId(it) === cursor)
  if (idx < 0) return
  const nextIdx = idx + dir
  if (nextIdx < 0 || nextIdx >= items.length) return
  event.preventDefault()
  const nextId = getId(items[nextIdx])
  patchedSelection.setCursor(nextId)
  patchedSelection.selectRange(nextId)
}
map['Shift+ArrowDown'] = advanceRange(1)
map['Shift+ArrowUp']   = advanceRange(-1)
map['Shift+j']         = advanceRange(1)
map['Shift+k']         = advanceRange(-1)
```

### 8.3 L2: "Done & next" — closures, not hook knowledge

```ts
// features/comments/components/buildCommentActions.ts (extended)
export function buildCommentActions(
  deps: {
    open: (c: CommentModel) => void
    closeDetail: () => void
    getNextOf: (id: string) => CommentModel | null
    markState: (id: string, s: CommentState) => Promise<void>
    deleteMany: (cs: CommentModel[]) => Promise<void>
  },
  t: TranslateFn,
): ReadonlyArray<ListAction<CommentModel>> {
  const markAndAdvance = (state: CommentState) => async ([c]: CommentModel[]) => {
    const next = deps.getNextOf(c.id)
    await deps.markState(c.id, state)
    next ? deps.open(next) : deps.closeDetail()
  }
  return [
    { key: 'mark-read',       shortcut: 'e',         shortcutLabel: 'E',  run: ([c]) => deps.markState(c.id, CommentState.Read) },
    { key: 'mark-read-next',  shortcut: 'Alt+e',     shortcutLabel: '⌥E', run: markAndAdvance(CommentState.Read) },
    { key: 'mark-junk',       shortcut: 's',         shortcutLabel: 'S',  run: ([c]) => deps.markState(c.id, CommentState.Junk) },
    { key: 'mark-junk-next',  shortcut: 'Alt+s',     shortcutLabel: '⌥S', run: markAndAdvance(CommentState.Junk) },
    { key: 'delete',          shortcut: 'Backspace', shortcutLabel: '⌫',  run: deps.deleteMany, multi: true, danger: true },
  ]
}
```

`getNextOf` is supplied by `CommentsRouteViewContent` and reads from the latest `commentsQuery.data` (post-invalidation), so "next" lands on the right row after mutations that remove the current row from the list.

### 8.4 L3 route shortcuts

```ts
// features/comments/hooks/use-comment-route-shortcuts.ts
export function useCommentRouteShortcuts(deps: {
  navigateTab: (tab: CommentTab) => void
  focusSearch: () => void
  focusComposer: () => void
}) {
  useEffect(() => tinykeys(window, {
    'g u': () => deps.navigateTab('unread'),
    'g r': () => deps.navigateTab('read'),
    'g j': () => deps.navigateTab('junk'),
    'g w': () => deps.navigateTab('whispers'),
    'g a': () => deps.navigateTab('awaiting'),
    'g l': () => deps.navigateTab('all'),
    '/'  : (e) => { e.preventDefault(); deps.focusSearch() },
    'r'  : () => deps.focusComposer(),
  }), [deps.navigateTab, deps.focusSearch, deps.focusComposer])
}
```

### 8.5 `?` shortcut overlay

A new app-shell provider:

```
ui/keyboard-shortcut-overlay/
  KeyboardShortcutsProvider.tsx
  useRegisterShortcuts.ts
  ShortcutOverlay.tsx
```

- `useRegisterShortcuts(items)` registers `{ group, key, label, hint? }[]` on mount and removes on unmount.
- `?` toggles the overlay (backdrop + centered `rounded-xl bg-surface-overlay shadow-lg` card with grouped items). `Esc` closes.
- The overlay itself is comment-agnostic — it only knows the registry shape. Comments page registers groups: `Navigation`, `Selection`, `Action`, `Composer`, `Global`.

## 9. Responsive behavior

| Breakpoint | Layout |
| --- | --- |
| `phone:` ≤768 | Single column. List ↔ detail driven by route. Top bar tabs scroll horizontally, active tab uses `scrollIntoView({ inline: 'center' })`. FilterStrip shows "More ▾" for overflow. Detail sidebar collapses into a top disclosure card. Composer sticky at the bottom; toolbar reduces to emoji + send. Selection bar is sticky at the bottom. Keyboard shortcuts are disabled. |
| `tablet:` 769–1023 | Two-pane master-detail. Meta sidebar defaults to hidden; the detail header gains an `[ⓘ Info]` toggle that opens a right-side drawer with the sidebar contents. |
| `desktop:` ≥1024 | Full three-zone layout: list 460px (resizable 320–600 via existing `ui/layout/resize-handle.tsx`), detail flex, sidebar 220px fixed. |

## 10. Empty / loading / error / optimistic

### 10.1 Empty (per tab, via `~/ui/patterns/EmptyState`)

| Tab | icon | title | description | action |
| --- | --- | --- | --- | --- |
| Unread | `Inbox` | "All caught up" | "No unread comments. Nice work." | "View all" |
| Awaiting | `MessageCircleReply` | "Nothing waiting" | "Every comment has had a reply from you." | — |
| Whispers | `Lock` | "No whispers" | "Private messages from readers appear here." | — |
| Read | `CheckCheck` | "Nothing read yet" | "Comments you mark read appear here." | — |
| Junk | `ShieldAlert` | "Junk is empty" | "Flagged or spam comments collect here." | — |
| All | `MessageSquare` | "No comments yet" | "Comments on your posts will appear here." | "Open blog ↗" |

Filtered-empty (search / refType / refId yields nothing) reuses `EmptyState` with:

- title: `"No matches"`
- description: echoes the active query (`"No results for source 'Why I left Notion'."`)
- action: `"Clear filters"`

### 10.2 Loading

- List initial load: three skeleton rows (`bg-surface-inset` shimmer; avatar circle + two text bars + meta bar).
- Detail load: existing centered spinner; sidebar shows three skeleton sections to avoid layout shift.
- Tab counts: while loading, the tab badge shows `…` (not `0`) to prevent a zero→N flicker.

### 10.3 Error

- List load failure: inline `ErrorState` card with a `Refresh` button and the error code (`HTTP_ERROR`, `INTERNAL_ERROR`).
- Single mutation failure: Sonner toast `"Failed to mark read — retry"`, with a retry action button.
- Offline (`navigator.onLine === false`): a yellow strip above the SelectionBar — `"Offline — actions will not sync until reconnected."` Mutations are sent and allowed to fail; offline queueing is out of scope.

### 10.4 Optimistic UI

- `markRead` / `markJunk` — list cache is updated immediately (row removed from the current tab when appropriate). Failure rolls back and toasts.
- `delete` — row fades out (`opacity` 200ms), then removed. Failure rolls back.
- Reply submit — pushed to `localReplies` immediately. Failure rolls back and restores textarea contents.

## 11. Testing

### 11.1 Frontend (vitest + jsdom)

| File | Coverage |
| --- | --- |
| `CommentListItem.test.tsx` | R3 rendering: identity precedence, parent-quote presence, badge conditionals, country flag fallback, source-chip click. |
| `CommentDetail.test.tsx` | D2 rendering: parent quote presence, spotlight card, sibling collapse, sidebar sections, threat-level three-state. |
| `CommentsRouteViewContent.test.tsx` | Six tabs with counts, `?tab=` URL sync, filter strip chip toggling, SelectionBar replacement when selection > 0. |
| `use-comment-tab-counts.test.ts` | Query key shape, 30s stale time, mutation-driven invalidation. |
| `use-author-activity.test.ts` | Either mail or ip enables the query; neither disables it. |
| `use-comment-route-shortcuts.test.tsx` | `g u` navigates tab, `/` focuses search, unmount cleans bindings. |
| `buildCommentActions.test.ts` | `getNextOf` closure behavior, single-target gating on `*-next`, `available` predicates. |
| `useListKeyboard.test.tsx` (existing extended) | `Shift+ArrowDown` / `Shift+ArrowUp` / `Shift+KeyJ` / `Shift+KeyK` range-select. |

### 11.2 Backend (vitest + pg testcontainer)

| File | Coverage |
| --- | --- |
| `comment-tab-counts.spec.ts` | Six values correct in a single SQL; refType/refId filters; deleted/junk edge cases. |
| `comment-awaiting.spec.ts` | All three predicates: owner never replied / owner last reply earlier than latest activity / owner last reply is latest. |
| `comment-author-activity.spec.ts` | Mail/ip required; threat: trusted (30d no junk + ≥3 total), risk (prior junk, /24 7d junk ≥3), neutral. |
| `comment-country-enrich.spec.ts` | Builtin lookup hit/miss; Redis cache hit avoids repeated lookups. |
| `comment-list.spec.ts` (existing extended) | `?tab=` replaces `?state=`; deprecated `?state=` carries `Deprecation` header; `?author=` filter. |
| `comment-migration.spec.ts` | Expand-only migration does not block old reads; backfill scripts are idempotent and resumable. |

### 11.3 Out of scope

- Playwright E2E (admin has no harness yet).
- Visual regression / screenshots.

## 12. Rollout

Seven PRs. PRs are sized for ≤500 LOC of net change where possible.

| PR | Title | Contents | Risk |
| --- | --- | --- | --- |
| PR1 | `comment: add is_owner_reply + country_code columns` | Drizzle migration (nullable / default false). Service double-writes on reply mutation. Reads do not yet depend on the new columns. | very low (expand only) |
| PR2 | `comment: backfill is_owner_reply + country_code` | `scripts/backfill-owner-reply.ts`, `scripts/backfill-country.ts`. Idempotent, 1000-row batches, resumable. | low (read-side computation + single-column updates) |
| PR3 | `comment: add tab-counts + author-activity endpoints` | New controller routes, services, Zod schemas, views. Existing list endpoint untouched. | low (new endpoints) |
| PR4 | `comment: extend list with ?tab= and country enrich` | List service accepts `tab` / `author`. Response carries `countryCode`. Old `?state=` is honored as alias with `Deprecation: true`. | medium (compatibility surface) |
| PR5 | `admin: useListKeyboard range-select + shortcut overlay` | L1 generic change + `KeyboardShortcutsProvider`. Other list views regression-tested for unchanged behavior. | low (additive defaults) |
| PR6 | `admin: comments redesign UI` | TopBar / FilterStrip / SelectionBar split; R3 row; D2 detail + sidebar; composer; route shortcuts; density toggle. | medium (large UI replacement) |
| PR7 | `comment: drop legacy ?state= alias` | Remove alias and the `Deprecation` header. Synchronize `@mx-space/api-client`. Ships at least one core release after PR4. | low (deletion after one-release grace) |

### 12.1 Sequencing

- PR1 → PR2 → PR3 → PR4 can be merged in order independent of admin work; nothing user-visible changes yet.
- PR5 is independent; it lands once and is validated by existing list views (drafts, posts, categories) not regressing.
- PR6 depends on PR4 (list params) and PR5 (shortcut overlay registry).
- PR7 lags PR4 by at least one release.

### 12.2 Feature flag

This is admin-only and self-served. No GrowthBook gate. The density toggle (default Rich) provides per-user fallback if Rich proves too dense in practice.

### 12.3 Rollback

- PR1/PR2 are schema-add — not directly reversible, but their defaults keep old reads working; rolling back the admin app alone is sufficient.
- PR3/PR4 introduce new endpoints / parameters; rollback removes routes / params.
- PR6 replaces large UI subtrees — keep a backup branch (`feature/comments-legacy-2026-06-02`) for one release in case a hot rollback of the UI is needed.

### 12.4 Monitoring (one week post-PR6 deploy)

- `/api/comment/tab-counts` p95 < 100ms (post-warm Redis: < 10ms).
- `/api/comment/author-activity` p95 < 200ms.
- Sentry: no new error classes attributable to the new components / hooks.
- Manual: owner reports on the new flow during daily triage.

## 13. Open questions / deferred

- **Offline mutation queue.** The current design fails fast when offline. If the owner actually triages from spotty mobile networks, a follow-up PR can introduce a Workbox-style queue.
- **Saved searches / persisted views.** Power-user feature; deferred until there is concrete demand.
- **Visual regression.** Not adopted in admin yet; would benefit several recent UI redesigns including this one.
- **i18n.** Net-new translation keys (`comments.tab.awaiting`, `comments.shortcuts.*`, sidebar headings, threat labels) are added for `en-US` and `zh-CN` in PR6.

## 14. References

- DS v2 tokens: `apps/admin/src/styles/tokens.css` and `docs/superpowers/specs/2026-05-30-admin-ui-softening-design.md`.
- Existing list-keyboard infrastructure: `apps/admin/src/ui/list-actions/`.
- Existing master-detail shell: `apps/admin/src/ui/layout/master-detail-shell.tsx`.
- Mobile master-detail nav stack: `docs/superpowers/specs/2026-05-29-admin-master-detail-mobile-nav-stack-design.md`.
- Hjkl scope switching: `docs/superpowers/specs/2026-05-31-admin-hjkl-scope-switch-design.md`.
- Migration conventions: the `mx-migration-author` skill (expand-contract for rolling deploys).
