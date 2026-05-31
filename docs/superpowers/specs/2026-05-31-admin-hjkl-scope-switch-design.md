# Admin hjkl Scope Switching + Sidebar Hover-Nav

**Date:** 2026-05-31
**Author:** Claude (with user @innei)
**Status:** Approved for implementation

## Summary

Extend the admin's keyboard navigation. Today `j` / `k` (and `ArrowDown` / `ArrowUp`) move focus among items inside the active `FocusScope`. This spec adds:

1. `h` / `l` and `ArrowLeft` / `ArrowRight` to switch between adjacent visible `FocusScope`s.
2. Per-scope memory of the last-focused item, so switching back restores the cursor where it was.
3. Auto-wrapping of master-detail detail panes in a `FocusScope` so they participate without per-page boilerplate.
4. Fix a bug where the sidebar's `j` / `k` only move DOM focus without router navigation; after the fix, focusing a sidebar item navigates to it (matching the list-scope "focus = open" model already in use).
5. Sidebar parent items auto-expand when focused; `z` / `Space` toggle expand/collapse.

## Motivation

Recent work landed `useListKeyboard` + `useScopeArrowNav`, giving every list pane `j`/`k`/`Home`/`End` navigation. The right-hand keys (`h`/`l`/`←`/`→`) are unused and are the natural complement: in a master-detail layout the user thinks "left/right pane," and vim-style `h`/`l` matches that mental model.

A latent bug also surfaced: the sidebar registered `useScopeArrowNav` without an `onItemFocus`, so `j`/`k` move DOM focus but never push the route. The user expects the same "focus = activate" semantics that list panes now have.

## Topology

A FocusScope is **adjacent** to another iff they are both currently mounted, both visible (per `checkVisibility`), and they are siblings in DOM order according to `document.querySelectorAll('[data-focus-scope]')`. The switcher walks this list at fire time; switching does not wrap (boundary stops).

Rationale: explicit topology tables drift; DOM order tracks the visible layout. Hidden branches (mobile drawer when desktop is shown, empty detail pane) are filtered out so they cannot be reached.

## Components

### A. `focus-scope` store — per-scope last-focused memory

`store/initial-state.ts` adds:

```ts
lastFocusedItemPerScope: Map<string, string>  // scopeId -> data-id
```

`store/action.ts` adds:

```ts
setLastFocusedItem(scopeId: string, itemId: string | null): void
```

When `itemId` is null the entry is deleted. Reading is via a selector hook `useLastFocusedItem(scopeId)` plus an imperative `getLastFocusedItem(scopeId)`.

### B. `useScopeArrowNav` — record last-focused, accept extra bindings

Two edits to `ui/focus-scope/use-scope-arrow-nav.ts`:

1. Inside `focusAt`, after `target.focus(...)`, call `setLastFocusedItem(scopeIdRef.current, target.getAttribute('data-id'))`. Skips when `data-id` is absent.
2. Add an optional `extra?: KeybindingsMap` option, merged into the tinykeys binding map (caller bindings overwrite defaults on collision — matches `useListKeyboard`'s precedence rule). Used by shell to bind `z` / `Space` for sidebar fold-toggle.

### C. `useScopeSwitcher` — new shell-level hook

New file `ui/focus-scope/use-scope-switcher.ts`. Bound once in `AdminShell`. Binds `h`, `l`, `ArrowLeft`, `ArrowRight` to a single global tinykeys handler:

1. Read `getActiveScopeId()`. If null, noop.
2. Query `document.querySelectorAll('[data-focus-scope]')`, filter to visible (`isItemVisible` from `use-scope-arrow-nav`), dedupe by id keeping the first visible instance (same-id sibling dedupe — same approach `getScopeRoot` uses).
3. Find active scope index. If not found (orphan active id), noop.
4. Compute target index: `±1`. If out of bounds, noop (no wrap).
5. `setActiveScope(targetScopeId)`. Then resolve the focus target:
   - If `getLastFocusedItem(targetScopeId)` returns an id and a matching `[data-id="<id>"]` exists inside the target scope subtree, focus it.
   - Else focus the first `[data-scope-item]` descendant of the target scope's root.
   - Else focus the scope root itself (`tabIndex=-1` makes it focusable).
6. `scrollIntoView({ block: 'nearest' })` on the focused element.

Gating mirrors `useScopeArrowNav`:
- Event target not a text input (`isTextInputTarget`, includes contentEditable).
- Module-level `lastHandledEvent` guard to dedupe sibling listeners (only relevant if the hook is ever instantiated twice — defensive).

### D. `MasterDetailShell` auto-wraps detail

Current API: caller wraps the `list` slot in `<FocusScope id="X-list">`. The detail is rendered raw.

Change: add a `detailScopeId?: string` prop. When set, the shell renders the detail slot inside `<FocusScope id={detailScopeId}>`. Mobile drawer and desktop pane each get one — both registered under the same id; `getScopeRoot`'s existing dedupe handles the multiple-instance case.

Each master-detail page passes `detailScopeId` derived from its list scope id, conventionally `"<feature>-list-detail"`. Affected pages (existing list `FOCUS_SCOPE_ID`):

| Page | list scope | detail scope |
|---|---|---|
| Drafts | `drafts-list` | `drafts-list-detail` |
| Comments | `comments-list` | `comments-list-detail` |
| Topics | `topics-list` | `topics-list-detail` |
| Files (by type) | `files-by-type-list` | `files-by-type-list-detail` |
| Files (comment images) | `comment-images-list` | `comment-images-list-detail` |
| Files (orphans) | `orphans-list` | `orphans-list-detail` |
| Snippets | (existing) | (existing + new detail scope) |
| Search-index | (existing) | (existing + new detail scope) |
| Cron (definitions / history) | (existing) | (existing + new detail scope) |

(Exact constants will follow each page's current `FOCUS_SCOPE_ID` value; the table above shows the naming convention, not literal strings.)

The detail FocusScope wraps but does not itself define `[data-scope-item]` instances; detail-internal item navigation stays opt-in per detail component (e.g. `DraftDetail`'s existing `versionsScopeId`).

### E. Sidebar bug fix + auto-expand

`shell.tsx` rewrites the existing `useScopeArrowNav` call:

```ts
useScopeArrowNav({
  scopeId: FOCUS_SCOPES.sidebar,
  itemSelector: '[data-scope-item="nav"]',
  onItemFocus: (el) => {
    const href = el.getAttribute('href')
    if (href) navigate(href)
    const path = el.getAttribute('data-nav-path')
    if (path) sidebarExpand.expandPath(path)
  },
})
```

`sidebar-nav-item.tsx` adds `data-nav-path={props.node.route.path}` on each `NavLink` so the handler can address the expand-state entry without parsing hrefs.

### F. Sidebar expand state — lift to store

Today `apps/admin/src/ui/layout/sidebar-body.tsx:116` holds expand state in `useState<Set<string>>`. To let `shell.tsx` drive expand from arrow-nav and from a global `z` / `Space` handler, expand state moves to a new zustand slice `ui/layout/sidebar-expand-store.ts`:

```ts
interface SidebarExpandStore {
  expanded: Set<string>
  isExpanded(path: string): boolean
  expand(path: string): void
  collapse(path: string): void
  toggle(path: string): void
  setMany(paths: ReadonlyArray<string>): void  // for route-driven sync
}
```

`SidebarBody` reads from the store instead of local state. Existing route-driven expansion (collapse on route change, expand active branch) is migrated verbatim.

### G. `z` / `Space` toggle in sidebar

`AdminShell` uses the new `extra` option on `useScopeArrowNav`:

```ts
useScopeArrowNav({
  scopeId: FOCUS_SCOPES.sidebar,
  itemSelector: '[data-scope-item="nav"]',
  onItemFocus: (...) => { ... },
  extra: {
    z: (event) => toggleFocusedNavItem(event),
    ' ': (event) => toggleFocusedNavItem(event),
  },
})
```

`toggleFocusedNavItem` reads `document.activeElement`, walks up to the nearest `[data-nav-path]`, asks the route tree whether it has children, and if so calls `sidebarExpand.toggle(path)`. No-op for leaf items. Both handlers `event.preventDefault()` to suppress browser scroll on `Space`.

Z is reserved for fold-toggle semantics project-wide. Outside the sidebar there is currently no expandable list, so no other binding is wired in this spec — but the helper lives at `ui/list-actions/` so future expandable lists (Snippets groups, etc.) can opt in with one line.

## Conflict matrix

| Source | Resolution |
|---|---|
| `h`/`l`/`j`/`k` typed into Markdown editor (Lexical, contentEditable) | `isTextInputTarget` gate (already covers `isContentEditable`) |
| `←`/`→` typed into search input | `isTextInputTarget` gate (covers `INPUT`/`TEXTAREA`/`SELECT`) |
| macOS browser back swipe / Cmd+`←` | Switcher only intercepts unmodified single keys |
| `Space` activating focused button | Switcher's `Space` binding fires only when active scope is sidebar AND focus is on `[data-nav-path]`; `event.preventDefault()` suppresses scroll. Non-sidebar `Space` untouched. |
| `Z` colliding with Cmd+Z undo | Single-key Z only; modified `Z` left alone |
| Mobile drawer + desktop aside both registered as `sidebar` scope | Existing `getScopeRoot` dedupe (containing-activeElement preference) |
| Detail pane has buttons/forms but no text input — `h` still leaves the pane | Accepted. The user pressed `h` deliberately to leave. |
| Switcher fires before `useScopeArrowNav` for the same key (impossible — disjoint keys, but defensive) | Keys are disjoint by construction (`hl←→` vs `jk↑↓HomeEnd`) |
| `data-id` collision across scopes (same id appears in two visible scopes) | Last-focused lookup scopes the `querySelector` to the target scope root, so cross-scope collisions never match |

## Test plan

Vitest + jsdom + tinykeys, mounted under `apps/admin/src/ui/focus-scope/__tests__/`:

1. Two FocusScopes A (left) + B (right) both mounted, A active. Press `l` → B active, focus lands on B's first `[data-scope-item]`.
2. After (1), press `j` then `h` → A active again, focus restored to the previously-focused item in A (not the first).
3. B hidden via `display:none` → from A, pressing `l` is a no-op (boundary stop).
4. From inside a `<textarea>` inside A, `h`/`l` are passed through to the input (gate).
5. Sidebar: focus a nav item via `j` → asserts `navigate(href)` was called with the item's href.
6. Sidebar parent item: focus via `j` → asserts `sidebarExpand.expand(path)` was called.
7. Sidebar focused on parent: press `z` → toggles expand state; press again → collapses.
8. Sidebar focused on leaf: press `z` → no-op.
9. MasterDetailShell with `detailScopeId` set: detail subtree contains `[data-focus-scope="...-detail"]` exactly once per branch; from list scope, `l` switches active to detail scope.
10. Detail-internal sub-scope (e.g. `DraftDetail`'s `versionsScopeId`): is reachable from the detail scope via `l` (DOM-order sibling).

## Out of scope

- Z bindings on non-sidebar expandable surfaces (Snippets groups, tree views). Helper is exported so a follow-up can wire them with one line.
- Custom per-page topology overrides (e.g. "skip the filter chip strip"). DOM order is the contract.
- Keyboard hint overlay / cheatsheet UI.
- Accessibility verification beyond `aria-current` / `aria-expanded` already in place.

## Files touched

- `apps/admin/src/ui/focus-scope/store/initial-state.ts`
- `apps/admin/src/ui/focus-scope/store/action.ts`
- `apps/admin/src/ui/focus-scope/store/store.ts` (type only)
- `apps/admin/src/ui/focus-scope/hooks.ts` — add `getLastFocusedItem` / `useLastFocusedItem` selectors
- `apps/admin/src/ui/focus-scope/use-scope-arrow-nav.ts` — record last-focused + `extra` option
- `apps/admin/src/ui/focus-scope/use-scope-switcher.ts` — new
- `apps/admin/src/ui/focus-scope/index.ts` — export new hook + selectors
- `apps/admin/src/ui/layout/master-detail-shell.tsx` — `detailScopeId` prop, wrap detail
- `apps/admin/src/ui/layout/sidebar-expand-store.ts` — new
- `apps/admin/src/ui/layout/sidebar-body.tsx` — consume store
- `apps/admin/src/ui/layout/sidebar-nav-item.tsx` — add `data-nav-path`
- `apps/admin/src/shell.tsx` — `onItemFocus` navigates + expands; `extra` Z/Space binding; `useScopeSwitcher()`
- Each master-detail page using `MasterDetailShell` — pass `detailScopeId`
- Tests under `apps/admin/src/ui/focus-scope/__tests__/`

## Open questions

None at design time. Implementation may surface ergonomic tweaks (e.g. should `h` from the leftmost scope also collapse the active sidebar branch?) — defer to follow-up if it comes up.
