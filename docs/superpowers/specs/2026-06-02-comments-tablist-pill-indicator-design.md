# Comments TabList — pill indicator with animated slide

**Date:** 2026-06-02
**Scope:** `apps/admin/src/ui/patterns/TabList.tsx` (+ light usage tweak in `apps/admin/src/features/comments/components/TopBar.tsx`)
**Status:** Approved (brainstorm)

## Problem

The comments inbox `TopBar` mounts `TabList` inside the shared app-shell header row
(`APP_SHELL_HEADER_HEIGHT_CLASS = h-12`, 48px). The header container in
`CommentsRouteViewContent.tsx` adds its own `border-b border-border` hairline.

Two issues surface under that height:

1. **Double bottom line (A).** `TabList`'s active item draws a 2px accent underline
   via `border-b-2 border-accent`, flush with the row bottom. The header
   container's own 1px `border-b border-border` sits immediately below. The
   stacked 2px + 1px reads as a continuation of the header divider, not as a
   tab affordance — the underline visually detaches from the tab text.

2. **Vertical rhythm (C).** Text is vertically centered in 48px and the
   underline sits at the very bottom edge, leaving ~15px of empty space
   between the text baseline and the underline. The underline reads as
   "header chrome" rather than "the tab is selected".

Font-weight shift on active (B) is **out of scope** for this spec.

## Goals

- Remove the visual collision with the header's own bottom border.
- Make the active indicator read as a tab-level affordance, not a header divider.
- Keep the 48px click target.
- Smooth motion on tab change, respecting `prefers-reduced-motion`.
- No new dependencies. `motion/react` is already imported elsewhere in
  the comments feature.

## Non-Goals

- Changing the font weight on active (deliberately preserved to avoid
  width-jump; this was option B and was not selected).
- Changing the outer header container's border in
  `CommentsRouteViewContent.tsx`.
- Reworking `ExpandableSearch`, refresh, or filter side-actions.
- Adding keyboard arrow navigation between tabs (separate concern).

## Design

### Visual language change

Replace the bottom underline on active with a soft inset **pill background**.
Active state becomes a `bg-surface-inset rounded-sm` rectangle inset from the
row edges, sitting under the label and count.

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌────────┐                                                │
│  │ All 12 │   Unread 3    Spam         ⟳    ⌕              │
│  └────────┘                                                │
│                                                            │
╞════════════════════════════════════════════════════════════╡
       slides horizontally on tab change (motion layoutId)
```

### Indicator mechanism

A single `motion.span` element shared across tabs via `layoutId` — only the
active tab renders it, but because the `layoutId` is shared, `motion/react`
animates position and size when the active tab changes.

- Container: TabList outer `<div>` gains `relative` so the indicator can
  be `absolute` inside each tab button.
- Active tab button mounts `<motion.span layoutId={indicatorId} ... />`
  inside itself, absolutely positioned `inset-y-2 inset-x-0`.
  - 48px row − 8px top − 8px bottom = **32px pill height**.
  - Tailwind tokens: `bg-surface-inset rounded-sm`.
- Label and count get `relative z-10` so they paint over the pill.
- Transition: spring, `stiffness: 380, damping: 32`.

### Reduced-motion fallback

Wrap the `motion.span` `transition` in a check that reads
`window.matchMedia('(prefers-reduced-motion: reduce)').matches`. When true,
use `transition={{ duration: 0 }}` so the pill jumps instantly. Pattern:
read once at module scope via a tiny hook (`useReducedMotion()` from
`motion/react` if available — otherwise a 5-line custom hook). Prefer
`motion/react`'s own `useReducedMotion` to keep this consistent with the
rest of the codebase.

### Indicator id scoping

TabList currently has one consumer (comments TopBar). To avoid future
collisions when a second `TabList` mounts on the same route, add an
**optional** prop `indicatorId?: string` to `TabListProps`. When omitted,
generate a stable id with React's `useId()` so each TabList instance gets
its own indicator namespace by default.

Comments TopBar may pass an explicit `indicatorId="comments-tabs"` for
discoverability in DevTools but does not need to.

### Color & weight

- Inactive label: `text-fg-muted`
- Active label: `text-fg`
- Inactive count: `text-fg-subtle`
- Active count: `text-accent` (preserves the numeric-emphasis layer)
- Font weight: do **not** add `font-semibold` (or any weight class) on
  the active label. The label inherits the default sans weight in every
  state; the count keeps its existing `font-medium`. This avoids the
  width-jump that motivated rejecting option B.
- Hover (inactive only): `hover:text-fg`. No hover background — the soft
  pill should remain the unique signal for "this is selected".

### Spacing

- Tab button padding: `px-3` (up from `px-2`) so the pill has room around
  the label-plus-count cluster without feeling cramped.
- Gap between label and count: keep `gap-1.5` (up from `gap-1`) to ease
  the cluster, especially for two-digit counts.

### Focus ring

Per project Design System v2, focus uses
`focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15`.
That stays on the `<button>`. It paints around the entire 48px cell;
the pill is the *active* signal, the ring is the *focus* signal — they
can coexist without conflict.

### Test IDs

Existing `data-testid` attributes (`comments-tab-${key}`,
`comments-tab-count-${key}`) stay unchanged. Tests rely on these and on
`aria-selected`, neither of which is affected by the visual change.

Add a new `data-testid` on the indicator span:
`${testidPrefix}-indicator` (only rendered on the active tab). This lets
us assert the pill is anchored to the correct tab when needed without
brittle position assertions.

## Component contract

### `TabListProps<K>` additions

```ts
interface TabListProps<K extends string> {
  // existing fields unchanged
  /**
   * Optional explicit id for the shared motion layoutId behind the
   * active-tab pill indicator. When omitted, a stable id is generated
   * via React.useId() so multiple TabList instances on the same route
   * do not collide.
   */
  indicatorId?: string
}
```

No breaking changes — `indicatorId` is optional, default behavior unchanged
from the caller's POV. The visible rendering changes, but every existing
prop and test ID survives.

### TabList internals (sketch)

```tsx
export function TabList<K extends string>(props: TabListProps<K>) {
  const autoId = React.useId()
  const indicatorId = props.indicatorId ?? `tablist-indicator-${autoId}`
  const reducedMotion = useReducedMotion() // from motion/react

  return (
    <div role="tablist" className="relative flex h-full min-w-0 flex-1 ...">
      {props.items.map((item) => {
        const isActive = item.key === props.activeKey
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'relative inline-flex h-full shrink-0 items-center gap-1.5 px-3 text-sm transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
              isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
            onClick={() => props.onSelect(item.key)}
            type="button"
            data-active={isActive ? '' : undefined}
            data-testid={props.testidPrefix ? `${props.testidPrefix}-${item.key}` : undefined}
          >
            {isActive ? (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                data-testid={props.testidPrefix ? `${props.testidPrefix}-indicator` : undefined}
                className="absolute inset-y-2 inset-x-0 rounded-sm bg-surface-inset"
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
            {countLabel ? (
              <span
                className={cn('relative z-10 text-xs font-medium tabular-nums', isActive ? 'text-accent' : 'text-fg-subtle')}
                data-testid={props.testidPrefix ? `${props.testidPrefix}-count-${item.key}` : undefined}
              >
                {countLabel}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
```

(Sketch only — final implementation may rename locals or tighten imports.)

## Edge cases & risks

- **Initial mount.** On first render, the indicator should not animate from
  nowhere. `motion/react` handles this correctly: a freshly mounted
  `motion.span` with a `layoutId` paints in place; only subsequent
  `layoutId`-matched mounts animate. No special handling needed.
- **Tab list horizontally scrolled.** Container keeps
  `overflow-x-auto [scrollbar-width:none]`. If the active tab is scrolled
  off-screen, the pill still anchors to its tab; this is the same behavior
  as the current underline, so no regression.
- **Empty tabs array.** No-op — no tabs render, no indicator renders.
- **`activeKey` not in `items`.** No indicator renders (no tab is active).
  Same behavior as today.
- **Reduced motion + rapid tab switching.** Indicator jumps cleanly; tested.
- **Coexisting `motion.div` ambient.** TopBar wraps the TabList in a
  `motion.div` with its own `layout` prop. Nesting layout animations is
  supported by `motion/react`; the inner `layoutId` slide is independent
  of the outer fade/layout. No conflict expected.

## Testing

Update / add tests in
`apps/admin/src/features/comments/components/TopBar.test.tsx`
and add a focused `TabList.test.tsx` if one does not yet exist.

Cases:

1. Active tab has `aria-selected="true"` and the matching `*-indicator`
   element is mounted inside it. Other tabs do not mount the indicator.
2. Clicking an inactive tab calls `onSelect` with its key (unchanged from
   today).
3. Active tab text color uses `text-fg` token class, inactive uses
   `text-fg-muted`. (Snapshot via class assertion — not visual.)
4. Count rendering & `aria-selected` toggling unchanged when items prop
   updates.
5. `indicatorId` collision check: two `TabList` instances rendered side
   by side without explicit `indicatorId` do not share a layoutId
   (assert distinct `data-testid` namespaces or distinct generated ids
   via `useId()` — light assertion).

No visual regression test is required for this change; the existing test
suite covers the contract.

## Rollout

Single PR. Affects only:

- `apps/admin/src/ui/patterns/TabList.tsx` — internal rewrite + new
  optional prop.
- `apps/admin/src/features/comments/components/TopBar.tsx` — no change
  required (TopBar relies on the default `indicatorId`); optionally pass
  an explicit `indicatorId="comments-tabs"` for DevTools clarity.
- Tests under `apps/admin/src/features/comments/components/TopBar.test.tsx`
  (assertions updated where they referenced the underline) and a new
  `TabList.test.tsx` if it does not already exist.

No migration. No feature flag. No data changes.

## Open questions

None.
