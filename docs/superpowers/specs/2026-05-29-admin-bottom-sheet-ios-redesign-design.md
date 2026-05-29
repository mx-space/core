# Admin BottomSheet — iOS-Style Interaction Redesign

**Status:** Design approved (interactive prototype validated)
**Date:** 2026-05-29
**Scope:** `apps/admin/src/ui/feedback/bottom-sheet.tsx`
**Consumers:** `apps/admin/src/ui/layout/content-layout.tsx` (sole consumer; mobile master-detail aside)

## 1. Background and Problem

`BottomSheet` is the mobile aside of the master-detail `ContentLayout`. The current implementation provides only a minimal drag interaction:

- Drag is bound to the grabber only (`dragListener={false}`). The sheet body cannot be dragged; pulling the body down at `scrollTop=0` does nothing.
- Snap animation uses a duration-based spring (`{ type: 'spring', duration: 0.34 }`) that does not consume release velocity. Flicks have no inertia.
- Detent resolution uses fixed offset/velocity thresholds (`CLOSE_DRAG_OFFSET=140`, etc.) with no projection — the sheet does not "land where the finger was throwing it."
- Scrim opacity is a two-value `0 ↔ 0.35` toggle, not linked to sheet position.
- Sheet height is morphed between detents by changing the CSS `height` property. (Initial prototype tried this and produced an obvious "re-mount" jump between snaps.)

These gaps make the sheet feel non-native on touch devices. The user described it as "完全不行."

## 2. Goals

1. iOS-native drag feel: 1:1 tracking, rubber-band damping at boundaries, smooth spring with momentum on release.
2. Scroll/drag coordination: pulling the scrollable body down at `scrollTop=0` initiates a sheet drag.
3. Detent resolution by velocity projection — release lands at the detent closest to the projected position.
4. Linked scrim — opacity continuously tracks sheet position.
5. Smooth snap transitions with no layout reflow between detents.

## 3. Non-Goals

- iOS card-behind effect (background `main` scaling). Out of scope; would require changes to `ContentLayout` and risks regressing the mobile list. ([User decision Q4](#decision-log).)
- Additional detents (e.g. `small` / `content-fit`). Two detents (`half` / `full`) remain. ([User decision Q3](#decision-log).)
- New dependencies. Implementation stays on the existing `motion/react`. ([User decision Q2](#decision-log).)
- Haptic feedback — iOS Safari does not support `navigator.vibrate`; documented as a limitation in a code comment, not implemented.

## 4. Architecture

### 4.1 Core model: constant-height sheet, transform-only

The sheet's CSS `height` is fixed at `fullH` for the entire open lifecycle. Position between detents is controlled by `translateY` only. This is the single most important departure from the current code — it eliminates layout reflow on snap transitions and is the change that fixed the "re-mount" feel in the validated prototype.

Coordinate system (where `ty` is the translateY value applied to the sheet):

| State    | `ty` value          | Meaning                                |
|----------|---------------------|----------------------------------------|
| `full`   | `0`                 | Sheet top flush with safe-area-inset   |
| `half`   | `fullH - halfH`     | Sheet pushed down by the height delta  |
| `closed` | `fullH + 24`        | Sheet fully off-screen below           |

Where:
- `fullH = stageH - max(env(safe-area-inset-top), 12px)`
- `halfH = min(stageH * 0.62, stageH - 12px)` (preserves the existing `SNAP_HEIGHT` values that are asserted by `bottom-sheet.test.tsx`)

### 4.2 Drag origin coordination

Pointer-down can occur on either of two regions, and each has different handoff semantics:

- **Grabber** — Drag starts immediately. `e.preventDefault()` on `pointerdown`.
- **Body** — Drag is *tentative* until two conditions are confirmed on the first `pointermove`:
  1. `body.scrollTop === 0`
  2. Pointer is moving downward (`dy > 0` past a small dead-zone, e.g. 6px)
  
  If either condition fails, the body keeps its native scroll and drag is canceled (origin reset to `null`). If both pass, the drag becomes "committed" and `preventDefault()` is called on subsequent moves.

Header is not draggable (preserves tap targets for icon buttons).

### 4.3 Spring physics

A custom rAF-driven spring integrator (semi-implicit Euler):

```
a = -k * (ty - target) - c * vy
vy += a * dt
ty += vy * dt
```

Constants (validated in interactive prototype v2):

| Constant      | Value      | Notes                                     |
|---------------|------------|-------------------------------------------|
| `STIFFNESS`   | 400        | k                                         |
| `DAMPING`     | 40         | c — slightly under-damped, mild overshoot |
| `dt_max`      | 0.032s     | clamp to survive frame stalls             |
| Settle eps    | `|vy|<0.5 && |ty-target|<0.3` | terminate rAF loop |

On release the integrator inherits the live `vy` from pointer-tracking, so a flick continues kinetically through the spring rather than abruptly snapping.

Why not `motion/react`'s built-in `drag` + `transition`? `motion`'s spring does inherit pointer velocity on release, but it controls a Motion value and animates toward a single `animate` prop. Coordinating projection-based target selection + body-vs-grabber origin handoff + scrim derivation from the same Motion value is awkward in declarative `motion.div` form and ends up being equivalent code. A small hand-rolled spring driving a Motion `useMotionValue` is clearer.

### 4.4 Velocity tracking

Track pointer velocity from `pointermove`:

```
vy = (clientY_now - clientY_prev) / (t_now - t_prev)
```

Sample at every move event (no smoothing window in the prototype; revisit if jitter shows up in practice on real iOS). Reset on `pointerdown`.

### 4.5 Detent resolution (`resolveDetent`)

Pure function. Inputs: `ty`, `vy`, current `snap`, `{ TY_FULL, TY_HALF, TY_CLOSED }`. Output: next snap name.

```
projected = ty + vy * PROJECTION_SECONDS  // PROJECTION_SECONDS = 0.2

if vy > CLOSE_FLING (1500 px/s): return 'closed'        // strong downward fling
if vy < FULL_FLING (-1200 px/s) and snap != 'closed': return 'full'

// Otherwise: nearest detent to projected position
return argmin over {closed, half, full} of |projected - ty(detent)|
```

This is the only piece that needs a unit test (other behaviors are gesture-driven and jsdom-hostile).

### 4.6 Rubber-band

- Past `TY_FULL` (i.e. `ty < 0`): visual position is `ty * RUBBER_UP` where `RUBBER_UP = 0.06`. Internal `ty` is unbounded; only the `translateY` we *render* is damped.
- Past `TY_CLOSED`: no rubber-band needed; the sheet is off-screen and `closed` is its own state.

### 4.7 Scrim opacity (linked)

```
visualTy = clamp(ty < TY_FULL ? TY_FULL + (ty - TY_FULL) * RUBBER_UP : ty)
t = clamp((visualTy - TY_FULL) / (TY_CLOSED - TY_FULL), 0, 1)
alpha = 0.35 * (1 - t)
```

Set as inline `style.opacity` on the scrim. No transition CSS — the rAF tick already handles smoothness.

### 4.8 Corner radius morph

At `full` snap, when the sheet top is at or near the safe-area edge, corner radius reduces from 24px → 16px to feel flush. Interpolated by proximity:

```
fullProx = max(0, 1 - max(0, ty - TY_FULL) / 60)   // [0, 1]
radius = 24 - 8 * fullProx                          // [16, 24]
```

### 4.9 Snap transitions (programmatic, e.g. toggle button)

Same spring path. `target` is set to the new detent's `ty`; the integrator runs from current `ty, vy` to settle. No height change, no `AnimatePresence` reuse — just `target` updates and the rAF loop.

Initial `open` (mount): `ty = TY_CLOSED`, `target = TY_HALF` (or `TY_FULL` if `defaultSnap="full"`). Enter animation is the spring from `TY_CLOSED` to `target` with `vy = 0`.

Exit (`onClose`): `target = TY_CLOSED`. On settle, `AnimatePresence`-style unmount is handled by gating the rendered tree on a separate `mounted` state that flips to `false` after the spring resolves to `closed`.

### 4.10 Module structure

Keep everything in `bottom-sheet.tsx` (consumer expects the named export from this single file). Internal organization:

```
bottom-sheet.tsx
├─ constants block (STIFFNESS, DAMPING, projection, rubber, fling thresholds)
├─ resolveDetent(state) — pure, exported for testing
├─ useSheetGesture(opts) — custom hook: returns
│     { ty: MotionValue, scrimOpacity: MotionValue, bind: { onPointerDown, ... } }
│   - manages the rAF spring loop
│   - manages pointer origin handoff
│   - exposes Motion values consumed by motion.div via style={{ y: ty }}
├─ BottomSheet — JSX shell (portal, scrim, sheet, grabber, header, body, footer)
```

`motion.div` is still used for the sheet element but with `style={{ y: tyMotionValue }}` — `motion/react`'s `drag` prop is *not* used (we drive ty manually). This keeps the spring integration in our control while letting Motion compositor-layer the transform.

## 5. API Compatibility

All public props are preserved verbatim:

```ts
interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  icon?: LucideIcon
  headerActions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  bodyClassName?: string
  className?: string
  defaultSnap?: BottomSheetSnap
  snap?: BottomSheetSnap
  onSnapChange?: (snap: BottomSheetSnap) => void
}

export type BottomSheetSnap = 'half' | 'full'
```

`SNAP_HEIGHT` constant remains exported-shape-compatible:
- `half: 'min(62dvh, calc(100dvh - 12px))'`
- `full: 'calc(100dvh - max(env(safe-area-inset-top), 12px))'`

These strings are referenced by name in `bottom-sheet.test.tsx` (`expect(sheet.style.height).toBe('min(62dvh, calc(100dvh - 12px))')`). The constant-height implementation sets `style.height` to the `full` value always, then renders the appropriate detent via `translateY`. Existing tests inspect `style.height` after toggle clicks; they will need an update — see §6.

## 6. Testing

**Existing tests (`bottom-sheet.test.tsx`) — these change**:

- `'renders nothing when closed'` — unchanged (pre-open `mounted=false`).
- `'renders sheet, title and close button when open'` — unchanged.
- `'calls onClose when close button is clicked'` — unchanged.
- `'calls onClose when scrim is clicked'` — unchanged.
- `'calls onClose when Escape is pressed'` — unchanged.
- `'uncontrolled snap toggle switches between half and full'` — **must change**. The old test asserted `sheet.style.height` toggled between the two `SNAP_HEIGHT` strings. In the new model, `style.height` is always the `full` value; the snap is reflected in `translateY`. New assertion: a `data-snap="half"` / `data-snap="full"` attribute on the sheet element (added for testability and devtools clarity).
- `'controlled snap ignores internal state and only fires onSnapChange'` — same `data-snap` migration.

**New unit tests**:

- `resolveDetent`: cover projection-to-nearest-detent, both fling thresholds, current-snap context (cannot go to current snap as `full` from `closed`, etc.).

**Not unit-tested** (jsdom cannot drive pointer/rAF + spring meaningfully): gesture, scrim alpha linkage, body-vs-grabber origin handoff. These were validated in the interactive prototype (`.superpowers/brainstorm/79279-1780046630/content/interactive-prototype-v2.html`) and should be re-validated on a real iOS device after the implementation lands.

## 7. Risks and Open Items

- **Real-iOS verification**: prototype was validated in desktop browser. Touch event timing on iOS Safari may surface velocity-tracking jitter that isn't visible on desktop. If so: apply a small EMA filter on the velocity samples. Decide after the first device test, not preemptively.
- **`motion/react` style-value reads inside event handlers**: `MotionValue.get()` is synchronous and cheap, no concern.
- **Body scroll-restoration**: out of scope; the existing comment in the file flags this as a future cleanup. Do not address here.
- **`PortalLayerScope` z-index**: unchanged. `useFloatingZ('drawer')` tier shared with `Drawer` — intentional, preserved.

## 8. Decision Log

| # | Question                              | Decision               |
|---|---------------------------------------|------------------------|
| Q1 | What is the primary focus?            | All three (gesture + visuals + motion) — full rebuild |
| Q2 | Can we add a dependency (`vaul`)?     | No — stay on `motion/react` |
| Q3 | Detent strategy                       | Keep `half` / `full` two-detent |
| Q4 | Include card-behind background scale  | No — scope confined to `bottom-sheet.tsx` |

Visual mockup and interactive prototype both validated by user prior to spec.

## 9. References

- Current implementation: `apps/admin/src/ui/feedback/bottom-sheet.tsx:1-239`
- Sole consumer: `apps/admin/src/ui/layout/content-layout.tsx:180-188`
- Existing tests: `apps/admin/src/ui/feedback/bottom-sheet.test.tsx`
- Validated interactive prototype: `.superpowers/brainstorm/79279-1780046630/content/interactive-prototype-v2.html`
- Visual mockup: `.superpowers/brainstorm/79279-1780046630/content/sheet-states.html`
- iOS detent + projection pattern: WWDC 2021 "Customize and resize sheets in UIKit" (background reference)
