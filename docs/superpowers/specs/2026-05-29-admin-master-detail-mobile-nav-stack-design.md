# Admin MasterDetailLayout — Mobile Navigation Stack Redesign

**Status:** Design approved (pending written-spec review)
**Date:** 2026-05-29
**Scope:** `apps/admin/src/ui/layout/page-layout.tsx` (`MasterDetailLayout`), `apps/admin/src/routes.tsx`, and the 22 feature pages currently consuming `MasterDetailLayout`.
**Out of scope:** `apps/admin/src/ui/layout/content-layout.tsx` (`ContentLayout` / `BottomSheet`) — covered by the separate `2026-05-29-admin-bottom-sheet-ios-redesign-design.md`. `ContentLayout` is used by the editor/config-panel pages (`features/write`, `features/ai/article-grouped`) where the BottomSheet semantics fit; it is not migrated here.

## 1. Background and Problem

`MasterDetailLayout` is the shared list-and-detail shell used by 22 admin pages (drafts, comments, projects, files ×3, settings, snippets, search-index, ai, ai/article-grouped, templates, enrichment, readers, backup, webhooks, categories, cron-definitions, cron-history, topics).

Current behaviour:

- Desktop (`lg:flex`): `PanelGroup` (`react-resizable-panels`) renders list + detail side-by-side with a resize handle.
- Mobile (`lg:hidden`): two absolutely-positioned panes overlap; selection toggles a local `showDetailOnMobile` state which applies `translateX(-100%)` to list and `translateX(0)` to detail via a 300ms CSS transition.

The mobile fallback has three structural failures:

1. **Local-state-only navigation.** `showDetailOnMobile` is a `useState` in each of the 22 consumers. Detail visibility is not persisted in the URL — refresh or share loses the detail; browser back / iOS swipe-back never closes the detail because they target router history, not local state. The screenshot the user captured on iPhone XR shows a detail pane visible without any explicit URL change, with no path to return short of tapping list items.
2. **Non-native transition.** The CSS `transition-transform 300ms ease-out` does not consume drag velocity, has no momentum, no rubber-band, no spatial parallax of the list behind the detail. iOS users expect detail to push in from the right with the list visibly sliding partially behind it, and to be drag-dismissible from the left edge.
3. **Two divergent paradigms.** `ContentLayout` (editor/config-panel) uses `BottomSheet` for mobile; `MasterDetailLayout` (list/detail browse) uses translate-x. The two layout components are visually and interactively unrelated, and the codebase has no shared model for "mobile aside of a desktop split."

The combination produces the screenshot the user labelled "完全不行" — `MasterDetailLayout` does not feel like a native mobile app at any narrow viewport.

## 2. Goals

1. URL is the single source of truth for detail visibility. `/drafts/:id` opens the drafts detail on both desktop (right aside) and mobile (full-screen overlay). Refresh, share, browser back, and iOS swipe-back all work without per-feature handling.
2. Mobile detail mount feels native: iOS-style push transition (translateX from right, list parallax-shifted left), edge swipe-back gesture with velocity-projected detent resolution, spring physics.
3. List parent route stays mounted while detail is open — scroll position, focus scope, filter, selection, and TanStack Query cache all survive detail mount/unmount without per-feature work.
4. Detail component is data-self-sufficient: receives `id` from `useParams`, fetches via TanStack Query with list-cache `initialData` so push transitions never flash a loading state when the entity is already cached.
5. Single shared detail header that renders the back affordance on mobile only — same component, same data, two viewport-specific compositions.
6. Migration is one PR. All 22 pages move to the new shell together. `MasterDetailLayout` is removed in the same change.

## 3. Non-Goals

- `ContentLayout` / `BottomSheet`. They keep their existing BottomSheet redesign track; do not touch.
- Adding loader/action data APIs on top of React Router v7. The new pattern is compatible with future data routes but does not adopt them in this change.
- Desktop visual changes. The desktop side-by-side PanelGroup remains; this redesign only changes how the same content is composed on mobile and how its URL drives both.
- Custom transition libraries. Reuses the rAF spring integrator from the BottomSheet iOS redesign.

## 4. Architecture

### 4.1 Design decisions ledger

| # | Question                                          | Decision                                                                 |
|---|---------------------------------------------------|--------------------------------------------------------------------------|
| Q1 | Mobile master-detail strategy                     | Strategy 2 — navigation stack (push detail as route on mobile)           |
| Q2 | URL ownership                                     | URL is single source of truth on both desktop and mobile                 |
| Q3 | Router structure                                  | React Router nested route with `<Outlet/>`                               |
| Q4 | Layout component API                              | `<MasterDetailShell>` (parent route) + `<MasterDetailOutlet>` (slot)     |
| Q5 | Mobile transition                                 | iOS push (translateX) + list parallax (−0.25·W) + edge swipe-back        |
| Q6 | List mount during mobile detail focus             | List stays mounted under the detail overlay                              |
| Q7 | Migration cadence                                 | Big bang — single PR migrates all 22 pages                               |
| Q8 | Detail data flow                                  | `useQuery` with `initialData` from list cache                            |
| Q9 | Detail header                                     | Shared `<DetailHeader>` component, back button mobile-only via CSS       |
| Q10 | Routes registration                              | Per-feature `routes.tsx` exporting `RouteObject`, aggregated in root     |
| Q11 | Coexistence with `ContentLayout`                 | Separate paradigm; not migrated; BottomSheet spec applies there          |

### 4.2 Routing model

Each feature owns a `routes.tsx` exporting a React Router `RouteObject`-shaped descriptor (typed against `RouteObject` from `react-router`, lazy components handled by a small `lazyRouteElement(loader)` wrapper that wraps each `lazy()` import in `<Suspense>` to match the existing `routes.tsx` pattern):

```tsx
// apps/admin/src/features/drafts/routes.tsx
import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { lazyRouteElement } from '~/router/lazy-route'

export const draftsRoute: RouteObject = {
  path: 'drafts',
  element: lazyRouteElement(() => import('./components/DraftsRouteViewContent')),
  children: [
    {
      path: ':id',
      element: lazyRouteElement(() => import('./components/DraftDetail')),
    },
  ],
}
```

`apps/admin/src/routes.tsx` aggregates the 22 feature route objects under the authenticated shell route. The list element (`DraftsRouteViewContent`) renders `<MasterDetailShell>` and embeds a `<MasterDetailOutlet/>` placeholder where the detail `<Outlet/>` is portaled.

Detail visibility ⇔ presence of the child route. `useMatches()` / `useOutlet()` reports `null` when no child matches; the shell shows the empty-state aside on desktop and stays at list-only on mobile.

### 4.3 New layout components

`apps/admin/src/ui/layout/master-detail-shell.tsx`:

```tsx
export function MasterDetailShell(props: {
  list: ReactNode
  emptyDetail?: ReactNode
  // existing tuning props preserved
  defaultSize?: number
  minSize?: number
  maxSize?: number
  className?: string
  listClassName?: string
  detailClassName?: string
})
```

Responsibilities:

- Read `useMediaQuery(DESKTOP_MEDIA_QUERY)` to switch between desktop side-by-side and mobile stack composition.
- Read `useOutlet()` to know whether a detail child route is mounted.
- Maintain the aside DOM element ref via `useState<HTMLDivElement | null>(null)`, exposed by context so `<MasterDetailOutlet/>` can portal into it (mirrors the `ContentLayoutContext` / `asideEl` pattern already in `content-layout.tsx`).
- Desktop:
  - `PanelGroup` with list panel + resize handle + aside panel.
  - Aside panel contains the `asideEl` div. If `useOutlet()` is non-null, the `<Outlet/>` portals into it; otherwise the empty-state slot (`emptyDetail` or `<DetailEmpty/>`) renders.
- Mobile:
  - List is always rendered full-screen at z-index base.
  - If a detail outlet is mounted, an overlay container also covers the viewport at a higher z, hosting the detail via portal. The overlay drives the iOS push spring (§4.4) and parallax-shifts the list (§4.5).

`<MasterDetailOutlet/>` is a thin wrapper that returns `createPortal(<Outlet/>, asideEl)` from the shell context. It is rendered exactly once inside `MasterDetailShell`'s aside on desktop and inside the mobile overlay container on mobile. Because the `<Outlet/>` itself is the same React node, route transitions reconcile in place and state is preserved across viewport changes.

### 4.4 Mobile transition: iOS push + edge swipe-back

Coordinates: `x ∈ [0, W]` where `W = viewport width`. Detail `translateX = x`, list `translateX = −LIST_PARALLAX · (W − x)`.

Constants:

| Constant            | Value     | Notes                                            |
|---------------------|-----------|--------------------------------------------------|
| `LIST_PARALLAX`     | 0.25      | iOS-canonical parallax ratio                     |
| `STIFFNESS`         | 400       | k, shared with BottomSheet spring                |
| `DAMPING`           | 40        | c, mild overshoot                                |
| `EDGE_ZONE`         | 20 px     | pointerdown clientX must be `< 20` to qualify    |
| `INTENT_THRESHOLD`  | 8 px      | first move must satisfy `dx > 8 && dx > |dy|`    |
| `PROJECTION_SECONDS`| 0.2       | release projection horizon                       |
| `FLING_VX`          | 800 px/s  | velocity magnitude threshold                     |

Push transition (programmatic mount):
- Initial `x = W`, `target = 0`. rAF spring runs from right edge to flush. List parallax derives from `x` in the same tick.
- Exit (`navigate(-1)` or swipe dismiss commit): `target = W`. On settle, the overlay container unmounts via `AnimatePresence` gated on a `present` state flipped after the spring lands at `W`.

Edge swipe-back state machine:
- `pointerdown` on the overlay: tentative drag if `clientX < EDGE_ZONE`. Otherwise pointer events fall through to detail body (scroll, taps).
- First `pointermove`: commit if `dx > INTENT_THRESHOLD && dx > |dy|`. On commit, `e.preventDefault()` on subsequent moves; capture pointer.
- During drag: `x = clamp(start_x + dx, 0, W)`. No rubber-band on the leading edge (x < 0) — already at flush, no further travel; clamp suffices.
- Velocity tracking: `vx = (clientX_now − clientX_prev) / (t_now − t_prev)`, sampled per move, no smoothing in v1.
- `pointerup` / `pointercancel`: hand off to spring with inherited `vx`.

`resolveBack(x, vx)`:
```
projected = x + vx * 0.2
if vx > FLING_VX: return 'dismiss'        // strong rightward fling
if vx < -FLING_VX: return 'cancel'        // pull back hard
return projected > W / 2 ? 'dismiss' : 'cancel'
```

`dismiss` → `target = W`; on settle, call `navigate(-1)`. `cancel` → `target = 0`; spring settles, route unchanged.

Implementation: introduce a generic rAF spring primitive at `apps/admin/src/ui/motion/sheet-spring.ts`. The BottomSheet iOS redesign currently keeps its spring integrator local to `bottom-sheet.tsx`; this PR extracts it as a shared module so both surfaces (BottomSheet on `y`, master-detail on `x`) share constants and behaviour. `MasterDetailShell` instantiates one spring for `x`, derives list parallax + detail x via Motion `useTransform`.

### 4.5 List preservation during mobile detail focus

`MasterDetailShell` always renders the list as the base layer. When detail is mounted, the overlay covers it and the list `translateX` becomes `-LIST_PARALLAX · (W − x)`. This means:

- TanStack Query: list query stays subscribed; no refetch on detail unmount.
- Scroll: the list's `Scroll` container is in the DOM; scrollTop is preserved.
- Focus scope: `FocusScope` doesn't tear down. When detail closes, focus restoration is the responsibility of the list (existing `selection.clear` / `restoreFocus` patterns continue to work).
- Selection state: `useListKeyboard` state lives in the list component; survives detail open.
- Filter / pagination state: same — local to the list route element.

The list under the detail is `aria-hidden="true"` and `pointer-events: none` while the overlay is mounted to prevent stray taps on the obscured surface.

### 4.6 Detail data flow

Detail component reads `useParams()` for `id` and runs its existing entity query with `initialData` sourced from the list's cache:

```tsx
function DraftDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { data: draft } = useQuery({
    ...draftQueries.detail(id),
    initialData: () => findInListCache(queryClient, draftQueries.list, id, 'id'),
    initialDataUpdatedAt: () => Date.now() - 0, // treat as just-fetched to skip an immediate refetch flash
  })
  // …
}
```

Shared helper `useInitialDataFromList<T>` in `apps/admin/src/api/list-cache.ts`:

```ts
export function findInListCache<T>(
  qc: QueryClient,
  listQueryKey: QueryKey,
  id: string,
  idField: keyof T = 'id' as keyof T,
): T | undefined {
  for (const [, data] of qc.getQueriesData({ queryKey: listQueryKey })) {
    const items = extractListItems<T>(data)
    const hit = items.find((item) => String(item[idField]) === String(id))
    if (hit) return hit
  }
  return undefined
}
```

The helper iterates *all* cache entries for the list's base key (covering different filter / pagination combinations), so initial data hit rate is high regardless of which filter the user was on.

Each of the 22 features keeps its existing list/detail query factories. Per-feature changes:
- List click no longer calls `setSelected(id)` (the local state is gone). It calls `navigate(\`:id\`, { relative: 'path' })`.
- Detail no longer receives entity via props. It calls `useQuery` with the helper above.
- Empty state aside (desktop, no detail route mounted) renders a placeholder — kept as `emptyDetail` prop on `MasterDetailShell`.

### 4.7 Shared `<DetailHeader>`

`apps/admin/src/ui/layout/detail-header.tsx`:

```tsx
export function DetailHeader(props: {
  title: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  // back is implicit: useNavigate(-1) on mobile click; hidden on desktop
})
```

- Mobile: renders back button (`<HeaderBackButton onClick={() => navigate(-1)} />`) on the left, then title/icon, then actions on the right.
- Desktop: hides the back button via `lg:hidden` on the wrapper. Title/icon/actions render in the same row as today's `AsidePanel`.
- The existing `AsidePanel` component is reduced to a thin wrapper around `DetailHeader` + body + footer slots, or removed entirely if all consumers migrate to `DetailHeader` directly. See §6 for the consumer audit.

### 4.8 z-index layering

Mobile overlay sits above the list at `z = useFloatingZ('detail-stack')` (new tier registered in the floating-z scope). Below modals/drawers/toasts. The portal target is created at the shell root, not at the page root, so multiple nested master-detail surfaces (none exist today, but the model permits it) layer per shell.

### 4.9 Accessibility

- Mobile overlay traps focus via existing `FocusScope` patterns; on close, focus returns to the list item that opened it (resolved by `useNavigationType()` + the `id` param).
- `aria-hidden="true"` on the list while overlay is open.
- `aria-label="返回"` on the swipe-back area; programmatic back via the `HeaderBackButton`.
- Esc key navigates back when detail is focused (mobile and desktop both — current behaviour for `BottomSheet`).

## 5. Routes restructure

Each of the 22 features adds a `routes.tsx` exporting a `RouteObject` (or a typed equivalent). Example:

```tsx
// apps/admin/src/features/drafts/routes.tsx
import type { RouteObject } from 'react-router'
import { lazyRouteElement } from '~/router/lazy-route'

export const draftsRoute: RouteObject = {
  path: 'drafts',
  element: lazyRouteElement(() => import('./components/DraftsRouteViewContent')),
  children: [
    {
      path: ':id',
      element: lazyRouteElement(() => import('./components/DraftDetail')),
    },
  ],
}
```

`apps/admin/src/routes.tsx` becomes a thin aggregator:

```tsx
const featureRoutes = [
  draftsRoute,
  commentsRoute,
  projectsRoute,
  filesRoute,                   // contains children for /files/comments, /files/by-type, /files/orphan
  settingsRoute,
  snippetsRoute,
  searchIndexRoute,
  aiRoute,                      // contains article-grouped child
  templatesRoute,
  enrichmentRoute,
  readersRoute,
  backupRoute,
  webhooksRoute,
  categoriesRoute,
  cronRoute,                    // contains definitions + history children
  topicsRoute,
  // …non-master-detail routes remain inline (dashboard, debug, etc.)
]
```

Files (3 sub-pages: CommentImages, FilesByType, OrphanFiles) and Cron (Definitions, History) consolidate under one feature route with sibling children at the top level, each carrying their own `:id` detail child.

## 6. Migration plan (single PR)

Order of work within the PR:

1. Extract `useSheetSpring` from `bottom-sheet.tsx` to `~/ui/motion/sheet-spring.ts`. Re-import in `bottom-sheet.tsx` (no behaviour change).
2. Add `~/api/list-cache.ts` with `findInListCache` helper.
3. Add `~/ui/layout/master-detail-shell.tsx` (`MasterDetailShell`, `MasterDetailOutlet`, `MasterDetailContext`).
4. Add `~/ui/layout/detail-header.tsx` (`DetailHeader`).
5. Reduce `AsidePanel` to use `DetailHeader` internally, or delete if no remaining caller. (Audit: `AsidePanel` is currently in `content-layout.tsx`. Used by `ContentLayout` consumers — those are out of scope and keep `AsidePanel`. So `AsidePanel` is preserved as-is; `DetailHeader` is the new master-detail header. Two header components coexist, one per layout family.)
6. For each of 22 features:
   - Add `routes.tsx` exporting the `RouteObject`.
   - Migrate `*RouteViewContent.tsx`: remove `useState(showDetailOnMobile)` and `useState(detailId)`; replace `setShowDetailOnMobile(true)` calls with `navigate(\`:id\`, { relative: 'path' })`; replace `setShowDetailOnMobile(false)` with `navigate(-1)` where appropriate (e.g. after batch delete that removed the focused item).
   - Migrate detail component: pull `id` from `useParams`, run `useQuery` with `initialData` helper.
   - Replace `MasterDetailLayout` with `MasterDetailShell`; embed `<MasterDetailOutlet/>` inside (no `detail` prop).
   - Replace any uses of `MasterDetailLayout`'s `showDetailOnMobile` prop with the new outlet-driven flow.
7. Rewrite `apps/admin/src/routes.tsx` to aggregate the 22 feature route objects.
8. Delete `MasterDetailLayout` from `page-layout.tsx`. Keep `AppPage`, `PageHeader`, header action types — those are independent.
9. Update tests:
   - `content-layout.test.tsx` — unchanged.
   - Feature-level tests asserting list↔detail toggle by clicking items — rewrite to assert URL change via `MemoryRouter` instead of local state.
   - New test for `findInListCache` (pure function, easy unit test).
   - New test for `resolveBack` (pure function, easy unit test).
   - Gesture interaction is jsdom-hostile (same caveat as BottomSheet spec); validated by interactive prototype before this PR lands.

## 7. API compatibility

This is a deliberate breaking change inside the admin app. No external API surface is affected (admin SPA is consumed by `apps/core` only as a built artifact). Within the admin codebase:

- `MasterDetailLayout` is removed. Any future code referencing it must use `MasterDetailShell`.
- `showDetailOnMobile` is gone. Detail visibility is URL-controlled.
- Per-feature detail components now require an `id` in `useParams` to render meaningfully.
- Direct URL access to a stale id triggers the standard "not found" UX (`<DetailNotFound/>` placeholder, render-once when the query returns `undefined`).

## 8. Testing

**Unit tests (new):**
- `resolveBack(x, vx)` — fling thresholds, half-width pivot, projection.
- `findInListCache` — hit in single filter, hit in another filter's cache, miss.

**Component tests (refactored):**
- Each of the 22 feature `*RouteViewContent` tests gets a `MemoryRouter` wrapper with initial entries `['/drafts']` and `['/drafts/123']` to exercise both list-only and detail-mounted states.
- Tests previously asserting `getByText('草稿详情')` after a click now drive a click and then `await waitFor(() => expect(location.pathname).toMatch(/\/drafts\/\w+/))`.

**Gesture / animation (not unit-tested):**
- Edge swipe-back, push transition, parallax — validated by interactive prototype following the BottomSheet pattern. Re-validate on real iOS device after the PR lands.

**Manual test matrix:**
| Viewport         | Action                              | Expected                                              |
|------------------|-------------------------------------|-------------------------------------------------------|
| iPhone XR (414)  | Tap list item                       | Detail pushes in from right with list parallax left   |
| iPhone XR        | Edge swipe from left                | Detail follows finger; release > W/2 dismisses        |
| iPhone XR        | Browser back                        | Detail unmounts, list visible, scroll preserved       |
| iPad 1024 portrait | Tap list item                     | Aside panel renders detail (no overlay)               |
| Desktop 1440     | Tap list item                       | Aside panel renders detail; resize handle still works |
| Any              | Reload at `/drafts/123`             | Detail renders with cached initialData if available   |
| Any              | Navigate to `/drafts/<bad-id>`      | Detail empty/not-found state, no spinner loop         |

## 9. Risks and Open Items

- **Big-bang PR size.** 22 features × (routes + list + detail) ≈ 70+ files. Reviewers will need patience; consider stacking diffs (per-feature commit, single PR) for readability.
- **Stale id deep-link.** Reloading on `/drafts/<deleted-id>` shows empty state until query confirms. Mitigation: `useQuery` with `notFound` flag; render `<DetailNotFound/>` placeholder with a "back to list" affordance.
- **`initialData` staleness.** `initialDataUpdatedAt: Date.now() - 0` treats the initial data as fresh and suppresses an immediate refetch. If the list was paginated and the row is from page 1 last refreshed 10 minutes ago, the detail is 10 minutes stale until the user pulls to refresh. Accept for v1; revisit if support complaints surface.
- **Real-iOS verification (shared with BottomSheet).** Pointer event timing on iOS Safari may surface velocity jitter; mitigation is a small EMA on the velocity samples. Decide after device test.
- **HashRouter quirks.** Admin uses `HashRouter`; browser back works inside the hash. iOS Safari swipe-back at the *browser* level may operate on the previous page (before admin loaded) — the custom swipe-back gesture inside the overlay is therefore necessary regardless.
- **DetailNotFound vs. cache miss flash.** When deep-linking and the list isn't loaded yet, detail shows loading until the query resolves. Acceptable; loading inside an already-rendered overlay is less jarring than the v0 "blank route" experience.

## 10. References

- Current `MasterDetailLayout`: `apps/admin/src/ui/layout/page-layout.tsx:194-268`
- Current 22 consumers: see `git grep -l 'MasterDetailLayout' apps/admin/src`
- BottomSheet iOS redesign (sibling spec): `docs/superpowers/specs/2026-05-29-admin-bottom-sheet-ios-redesign-design.md`
- `ContentLayout` (out of scope): `apps/admin/src/ui/layout/content-layout.tsx`
- iOS nav stack reference: WWDC 2022 "Adopt the iPadOS 16 navigation API" (background reference)
- React Router v7 nested routes + Outlet: https://reactrouter.com/start/declarative/routing
