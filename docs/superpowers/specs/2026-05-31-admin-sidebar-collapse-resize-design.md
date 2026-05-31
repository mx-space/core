# Admin sidebar — collapse and resize

Date: 2026-05-31
Scope: `apps/admin`
Status: Approved — ready for implementation plan

## Motivation

The admin shell ships a fixed-width 240px left sidebar on desktop (`apps/admin/src/shell.tsx`,
`lg:grid-cols-[240px_minmax(0,1fr)]`). Users have no way to reclaim that horizontal real
estate when working on wide tables or split-pane editors, and no way to widen it for deeply
nested navigation. Mobile already has an off-canvas Drawer; desktop needs a comparable
affordance.

This spec adds collapse (fully hidden, 0px) and resize (drag, persisted) to the desktop
sidebar. Mobile behavior is unchanged.

## Decisions (from brainstorming)

1. **Collapse style** — fully hidden (0px). Restored via floating hamburger in the main area.
2. **Resize** — draggable, persisted to localStorage; clamped to [200px, 360px], default 240px.
3. **Triggers** — sidebar toggle button, `cmd/ctrl+b` keyboard shortcut, and drag-to-collapse
   (handle dragged below 120px threshold).
4. **Mobile/desktop state** — fully independent. The existing `ShellNavProvider` (mobile
   Drawer) remains untouched. Desktop collapse + width live in jotai atoms with
   `atomWithStorage`.
5. **Implementation** — keep the shell's CSS grid; drive the sidebar column through a
   `--sidebar-width` CSS variable. No outer `react-resizable-panels`.
6. **State** — jotai with an explicit `createStore()` injected via `<Provider store>`. Two
   atoms (`sidebarCollapsedAtom`, `sidebarWidthAtom`). Imperative pointermove writes go
   through the created store reference, not `getDefaultStore()`.
7. **Animation** — CSS `transition: grid-template-columns 200ms ease`, suppressed during
   active drag via `body[data-sidebar-resizing="true"]`.
8. **Resize handle** — reuse `~/ui/layout/resize-handle.tsx` styling conventions.

## Architecture

### File map

New:

- `apps/admin/src/store/jotai-store.ts` — `export const jotaiStore = createStore()`.
- `apps/admin/src/ui/layout/sidebar-layout/atoms.ts` — `sidebarCollapsedAtom`,
  `sidebarWidthAtom` (both `atomWithStorage`).
- `apps/admin/src/ui/layout/sidebar-layout/use-sidebar-layout.ts` — hook exposing
  `{ collapsed, widthPx, toggle, setCollapsed }`. Reads atoms, clamps width, attaches
  the `cmd/ctrl+b` keydown listener.
- `apps/admin/src/ui/layout/sidebar-layout/sidebar-resize-handle.tsx` — pointer-driven
  resize handle component. Owns drag lifecycle and the imperative `jotaiStore.set(...)`
  writes during pointermove.
- `apps/admin/src/ui/layout/sidebar-layout/index.ts` — barrel.

Edited:

- `apps/admin/src/providers.tsx` — wrap the tree in `<JotaiProvider store={jotaiStore}>`.
- `apps/admin/src/shell.tsx`:
  - Change `lg:grid-cols-[240px_minmax(0,1fr)]` to
    `lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]` and add the `transition` style.
  - Wire `--sidebar-width` from `useSidebarLayout()` (inline style on the `<main>` element
    OR via `document.documentElement.style` — see Data flow). Add `overflow-hidden` on the
    `<aside>` so its content stays clipped when the column is 0px.
  - Mount `<SidebarResizeHandle />` adjacent to the `<aside>` (absolute, right edge).
  - Render a floating hamburger button (desktop-only, visible when collapsed) that calls
    `setCollapsed(false)`.
- `apps/admin/src/ui/layout/sidebar-body.tsx` — add a collapse toggle button in the brand
  row's right cluster (desktop only), calling `toggle()`.
- `apps/admin/src/constants/layout.ts` — add:
  - `SIDEBAR_WIDTH_DEFAULT = 240`
  - `SIDEBAR_WIDTH_MIN = 200`
  - `SIDEBAR_WIDTH_MAX = 360`
  - `SIDEBAR_COLLAPSE_THRESHOLD = 120` (drag-to-collapse trigger, in pixels of `clientX`)
  - `SIDEBAR_COLLAPSED_STORAGE_KEY = 'admin:sidebar-collapsed'`
  - `SIDEBAR_WIDTH_STORAGE_KEY = 'admin:sidebar-width'`
- `apps/admin/index.html` — inline `<script>` in `<head>` to seed `--sidebar-width` from
  localStorage before first paint (anti-flash).

### Layout tree (desktop)

```
<main grid-cols=[var(--sidebar-width)_1fr], transition on grid-template-columns>
  <aside overflow-hidden>
    <FocusScope id=sidebar>
      <SidebarBody />     ← collapse toggle button lives here
    </FocusScope>
    <SidebarResizeHandle absolute right-0 />
  </aside>
  <section> {children} </section>
  {collapsed && <FloatingHamburger />}  ← desktop && collapsed; top-left fixed
  <Drawer> ...mobile sidebar... </Drawer>   ← unchanged
</main>
```

### Why two atoms, not one

`collapsed` and `widthPx` are written under different triggers (toggle vs drag) and read by
different subscribers (the grid template needs both; the handle reads only width). Two
atoms means a `collapsed` flip doesn't re-render width subscribers and vice versa. Storage
keys are distinct, so a stale partial write can't corrupt the other dimension.

## State

```ts
// atoms.ts
import { atomWithStorage } from 'jotai/utils'
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '~/constants/layout'

export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  false,
)

export const sidebarWidthAtom = atomWithStorage<number>(
  SIDEBAR_WIDTH_STORAGE_KEY,
  SIDEBAR_WIDTH_DEFAULT,
)
```

Note: `atomWithStorage` does NOT clamp on read. The hook clamps when exposing
`widthPx`, and the inline anti-flash script clamps on its own.

```ts
// use-sidebar-layout.ts (shape, not literal)
function useSidebarLayout() {
  const [collapsed, setCollapsedAtom] = useAtom(sidebarCollapsedAtom)
  const rawWidth = useAtomValue(sidebarWidthAtom)
  const widthPx = clamp(SIDEBAR_WIDTH_MIN, Number.isFinite(rawWidth) ? rawWidth : SIDEBAR_WIDTH_DEFAULT, SIDEBAR_WIDTH_MAX)
  const setCollapsed = useCallback((v: boolean) => setCollapsedAtom(v), [setCollapsedAtom])
  const toggle = useCallback(() => setCollapsedAtom(prev => !prev), [setCollapsedAtom])

  // cmd/ctrl+b listener — skip when focus is in input/textarea/contenteditable
  useEffect(() => { /* attach keydown on window */ }, [toggle])

  return { collapsed, widthPx, toggle, setCollapsed }
}
```

```ts
// providers.tsx (delta)
import { Provider as JotaiProvider } from 'jotai'
import { jotaiStore } from '~/store/jotai-store'

<JotaiProvider store={jotaiStore}>
  <QueryClientProvider ...>...</QueryClientProvider>
</JotaiProvider>
```

```ts
// sidebar-resize-handle.tsx (shape)
import { jotaiStore } from '~/store/jotai-store'
import { sidebarCollapsedAtom, sidebarWidthAtom } from './atoms'

// pointerdown: setPointerCapture(e.pointerId); body.dataset.sidebarResizing='true'
// pointermove:
//   const x = e.clientX
//   if (x < SIDEBAR_COLLAPSE_THRESHOLD) {
//     jotaiStore.set(sidebarCollapsedAtom, true)
//     // Do NOT touch sidebarWidthAtom — keep persisted width for next expand.
//     return
//   }
//   const next = clamp(MIN, x, MAX)
//   jotaiStore.set(sidebarWidthAtom, next)
//   jotaiStore.set(sidebarCollapsedAtom, false)  // re-expand if user drags back out
//   document.documentElement.style.setProperty('--sidebar-width', `${next}px`)
// pointerup / pointercancel / lostpointercapture / window.blur:
//   delete body.dataset.sidebarResizing; release pointer capture
```

## Data flow

1. **Bootstrapping**
   - `index.html` inline script reads localStorage, clamps, sets `--sidebar-width` on
     `<html>` before React mounts.
   - React mounts. `useSidebarLayout()` reads atoms (sourced from the same localStorage by
     `atomWithStorage`); values agree with the inline script (or fall back to defaults).
   - The shell renders with `grid-template-columns: var(--sidebar-width) 1fr`.

2. **Keyboard `cmd/ctrl+b`**
   - Listener attached in `useSidebarLayout` via `useEffect` on `window`.
   - Skip when `document.activeElement` matches `input, textarea, [contenteditable=""], [contenteditable="true"]`.
     This preserves browser/native bold and editor shortcuts.
   - Otherwise `e.preventDefault()` and `toggle()`.

3. **Sidebar toggle button** (in `sidebar-body.tsx`, brand row)
   - The brand row currently has shape `flex justify-between`: [brand logo+name] on the
     left, [DropdownMenu] on the right. Insert the collapse button into the right cluster
     immediately before the DropdownMenu, so the right cluster becomes
     `[collapse-btn] [dropdown-menu]` separated by `gap-1`.
   - Desktop only (`lg:` breakpoint — hide on mobile via `hidden lg:inline-flex`).
   - Plain icon button, `size-7`, hover background per Design System v2 surface tokens.
   - Icon: `PanelLeftClose` from lucide-react. Calls `toggle()`. (Always `PanelLeftClose`
     here because this button is only visible while the sidebar itself is visible, i.e.
     `collapsed=false`. The reciprocal "open" affordance is the floating hamburger.)

4. **Floating hamburger** (in `shell.tsx`)
   - Renders only when `desktop && collapsed`. Position: `fixed top-2 left-2`, z-30,
     small square button (`size-9`) with `PanelLeftOpen` icon.
   - Click calls `setCollapsed(false)`.
   - Must not collide with the existing `AiTaskFloatingButton` (which is `absolute
     bottom-4 right-4`) — different corner, no overlap.

5. **Resize drag** (in `sidebar-resize-handle.tsx`)
   - `pointerdown` → `setPointerCapture(e.pointerId)`, set `body.dataset.sidebarResizing = 'true'`.
   - `pointermove` → compute `x = e.clientX`:
     - If `x < SIDEBAR_COLLAPSE_THRESHOLD` (120): set `collapsed=true`. Do NOT write
       `widthPx` — the persisted width is preserved for the next expand.
     - Otherwise: clamp `x` to `[MIN, MAX]`, write `sidebarWidthAtom = clamped`, write
       `--sidebar-width` CSS var to `<html>`, and set `collapsed=false` (covers the
       "drag back out of the collapsed zone mid-drag" case).
   - `pointerup` / `pointercancel` / `lostpointercapture` / `window.blur` →
     `delete body.dataset.sidebarResizing`, release capture.
   - Persistence: `atomWithStorage` writes to localStorage on every set. We accept the
     write volume during a drag (~60/s); each call is a small JSON.stringify of a single
     number. If profiling shows it costs, switch to "write only on pointerup" in a later
     pass — out of scope for v1.

6. **Restore from collapse**
   - Any trigger that sets `collapsed=false` restores the column to the persisted
     `widthPx`. No special "last expanded" handling is needed at the `setCollapsed(false)`
     call site — the width atom was never zeroed.

7. **CSS var sync vs atom subscription**
   - The grid's `--sidebar-width` is computed both ways:
     - During steady state: React renders `<main>` with `style={{ '--sidebar-width': collapsed ? '0px' : widthPx+'px' }}`.
     - During drag: pointermove writes the var to `<html>` imperatively for sub-frame
       smoothness, bypassing React's commit. The next React render's inline style on
       `<main>` reasserts the correct value at the more specific scope.
   - This is intentional double-writing — the imperative path is for jank suppression
     during the drag; the React path is the source of truth between drags.

## Animation

- `<main>` carries `transition: grid-template-columns 200ms ease` (inline style or class).
- Drag suppression: in `index.css`,
  `body[data-sidebar-resizing="true"] main { transition: none; }`.
- During drag, `body { cursor: col-resize; user-select: none; }` to avoid text-selection
  flicker and pointer flicker over child elements.

## Resize handle component

```tsx
// sidebar-resize-handle.tsx (visual contract)
// - position: absolute; top: 0; right: -2px; width: 4px; height: 100%; z-index: 1
// - cursor: col-resize
// - background: transparent at rest; bg-border-strong on hover/active
// - aria-orientation="vertical"; role="separator"
// - rendered only when desktop && !collapsed (no point dragging a 0-width column)
```

This is a thin floating affordance, NOT a literal column inside the grid. Keeping it
out of the grid means the grid stays two columns and the transition target is simple.

## Edge cases

| Case | Handling |
|---|---|
| Storage width out of range or non-finite | Hook clamps to `[MIN, MAX]`; falls back to `DEFAULT` if `!Number.isFinite`. Inline script does the same. |
| Storage collapsed not boolean | Inline script: `JSON.parse` of falsy / non-`true` → false. Hook: `atomWithStorage` returns whatever it parses; we treat truthiness via plain conditionals. |
| `cmd+b` with focus in input / contenteditable | Skip — don't preventDefault, let native shortcut through. |
| pointerup missed (alt-tab, iframe, devtools) | Listen for `pointercancel`, `lostpointercapture`, and `window.blur` as well. |
| Pointer leaving viewport mid-drag | `setPointerCapture(e.pointerId)` on pointerdown keeps subsequent events flowing to the handle. |
| Viewport shrinks below 1024px | `lg:` grid swaps to single column; `<aside>` hides; `--sidebar-width` value is irrelevant. The hamburger floating button is gated on the desktop media query and also hides. Mobile's existing `ShellNavProvider`/`Drawer` takes over. |
| Viewport grows back above 1024px | Atom values persist; grid restores with the previously persisted width/collapsed state. |
| First-paint flash | Inline `<script>` in `index.html` head sets `--sidebar-width` on `<html>` before React mounts. Worst case (storage cleared): renders at 240px. |
| `lastExpandedPx` not needed | The pointermove rule "do NOT write width when `x < THRESHOLD`" means the persisted width is never overwritten by a collapse drag; no separate `lastExpandedPx` ref is required. |
| Storage key collisions | New keys are `admin:sidebar-collapsed` and `admin:sidebar-width` — namespaced and not overlapping with existing `__api`, `SESSION_WITH_LOGIN`, or other admin keys. |

### Inline anti-flash script

Insert in `apps/admin/index.html` `<head>` before any `<script type="module">`:

```html
<script>
  (function () {
    try {
      var c = JSON.parse(localStorage.getItem('admin:sidebar-collapsed') || 'false');
      var w = JSON.parse(localStorage.getItem('admin:sidebar-width') || '240');
      var px = (typeof w === 'number' && w >= 200 && w <= 360) ? w : 240;
      document.documentElement.style.setProperty('--sidebar-width', c ? '0px' : px + 'px');
    } catch (_) {
      document.documentElement.style.setProperty('--sidebar-width', '240px');
    }
  })();
</script>
```

`atomWithStorage` defaults to `JSON.parse` on read, so the inline script's parser stays
aligned with jotai's wire format. If a future change passes a custom serializer to
`atomWithStorage`, the inline script must be updated in lockstep.

## Testing

vitest + RTL. Follows the pattern in `apps/admin/src/ui/layout/content-layout.test.tsx`.

### `use-sidebar-layout.test.tsx`

- Empty storage → `{ collapsed: false, widthPx: 240 }`.
- Storage width = 500 → clamped to 360 on read.
- Storage width = "garbage" (parse fails) → 240 default.
- Storage collapsed = "yes" → coerced to false (or whatever `JSON.parse` yields, treated as truthy/falsy).
- `toggle()` flips collapsed and writes to storage.
- `cmd+b` toggles when focus is on body; does NOT toggle when focus is in `<input>` /
  `<textarea>` / contenteditable.
- `ctrl+b` behaves identically to `cmd+b` (cross-platform).

### `sidebar-resize-handle.test.tsx`

- `pointerdown` sets `document.body.dataset.sidebarResizing === 'true'`.
- `pointermove` to clientX=300 → atom width=300, `--sidebar-width: 300px` on `<html>`.
- `pointermove` to clientX=500 → clamped, atom width=360.
- `pointermove` to clientX=80 → `collapsed=true`, width atom unchanged.
- `pointerup` clears dataset and removes listeners.
- `pointercancel` and `window.blur` behave like pointerup.
- Component unmount removes all window listeners (no leak; assert with a spy on
  `removeEventListener`).

### `shell.test.tsx` (extend if it exists, otherwise add light shell test)

- Desktop (`matchMedia min-width: 1024px` mocked true): main element grid-template-columns
  resolves to `var(--sidebar-width)`; sidebar is in the DOM.
- `collapsed=true` on desktop: `--sidebar-width` is `0px`; floating hamburger button is
  rendered.
- Mobile (matchMedia false): grid is single-column; floating hamburger is NOT rendered
  (mobile uses the existing Drawer trigger from `ShellNavProvider`).
- Toggling collapse via the sidebar button updates the grid in the next render.

### Manual verification (not vitest)

- Hard reload with collapsed=true: no 240px flash. With collapsed=false and a custom
  width: opens at that width, not 240.
- Collapse transition is smooth (~200ms ease).
- Drag is jank-free; no transition snap during drag.
- React Compiler doesn't break memoization of the hook (admin uses react-compiler via
  Babel; manually scan compiled output if behavior looks off).

### Not tested

- jotai `atomWithStorage` internals (library-level).
- CSS transition timing (visual, not logic).
- localStorage write throughput during drag (acceptance is "no observable jank" via
  manual verification).

## Follow-ups (out of scope)

- `apps/admin/src/vendor/codemirror/image-popover-state.ts` uses `getDefaultStore()`
  rather than the explicit `jotaiStore`. Migrate it in a separate small PR to keep
  jotai store usage consistent across the app.
- If localStorage write volume during long drags shows up in profiling, batch the
  width persistence to `pointerup` only (atom in memory during drag, storage write on
  release).

## Out of scope

- Mobile sidebar behavior (`ShellNavProvider` + `Drawer`) — unchanged.
- Inner `ContentLayout` aside collapse/resize — already implemented.
- Sidebar content layout (icon-only rail mode, sectioned headers, etc.).
- Settings UI for adjusting min/max bounds — bounds are constants.
- Tutorial / onboarding hint for the new shortcut.
