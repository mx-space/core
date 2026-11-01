# Motion

Rules for everything that changes. The still frame is in `craft.md`.

## Causes

- **Every motion has a cause the reader can see:** their input, or a visible step in a sequence they started. No ambient floating, pulsing or shimmering.
- **Feedback starts on input.** A pressed control responds in the same frame; only the explanatory motion that follows may take time.
- **Data never rewinds in view.** Going back to a previous state is a new transition with its own cause (the reader pressed reset or picked the earlier option), never an automatic reverse.
- **Autoplay only when the subject is a process** (a sorting algorithm, a signal over time). Then start on a calm, complete frame, run only while visible (`IntersectionObserver`), and give a pause control.

## Changing values

- **Change only what changed.** Keep the surrounding layout still; a number that updates keeps its box width (`tabular-nums`, a min-width), so neighbors do not jitter.
- **Move, don't swap.** A bar grows from its old length to the new one; a marker travels to its new position. Use CSS transitions on `transform`, `width`, `height`, `opacity`.
- **Text that changes fades or slides in place** in 150 to 200ms; never blank for a frame.
- **Things that appear arrive whole**: fade plus a small translate (4 to 8px), not a pop from nothing. Things that leave do the reverse, faster.
- **Related updates overlap.** The control changes first, then what it drives, staggered 40 to 80ms, all within half a second.

## Pace and easing

- **UI feedback:** 120 to 200ms, `cubic-bezier(0.25, 0.8, 0.25, 1)`.
- **Travel** (a value or object moving to a new place): 300 to 600ms, `cubic-bezier(0.45, 0, 0.1, 1)`.
- **Nothing longer than about a second** unless the duration is the point being shown.
- **Animate `transform` and `opacity`** where possible; avoid animating layout properties on large trees.

## Reduced motion

- Wrap travel in `@media (prefers-reduced-motion: no-preference)`, or check `matchMedia('(prefers-reduced-motion: reduce)')` before starting script-driven animation.
- Reduced motion still shows every state change: the end state appears at once, or with a short opacity fade.

## Script-driven animation

- Prefer CSS transitions toggled by a class or a style change over `requestAnimationFrame` loops.
- When a loop is needed, keep its handle and cancel it in `unmount`; pause it when the component is off screen.
- Never animate with `setInterval` faster than the display; use `requestAnimationFrame` with elapsed time.
