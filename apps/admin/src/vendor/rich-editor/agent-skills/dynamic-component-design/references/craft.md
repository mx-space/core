# Craft: the still frame

Rules for what the component looks like when nothing moves. Motion is in `motion.md`.

## Restraint

- **Cut decoration, rank content.** A chart still needs its bars, a timeline its ticks, a comparison both sides, a summary all its numbers. What gets cut is framing: titles, subtitles, badges, helper text, captions that repeat the article. Facts are ranked, not removed.
- **Supporting facts form a quiet layer.** Under or beside the lead: a single row of small stats (value at 15 to 18px, label at 12px in `--fg-muted`, no cards, no borders between them), or secondary rows in a list, or a second view reached by a segmented control. Never a grid of equal KPI cards.
- **One number gets to be big.** Supporting numbers are medium; labels are small.
- **Say it once.** A value appears in one place, not in a badge, a tooltip and a legend at once.
- **No legend when labels fit on the marks.** Label the line or bar directly.
- **No chrome for its own sake.** No fake window bars, traffic lights, tabs or toolbars unless the article is about that interface.
- **Simplify before polishing.** Remove surfaces, borders and framing strings until the data stands alone, then add back only what helps read it. The facts are not part of what gets removed.
- **Space follows the subject.** The focal object gets the room; no empty band in the middle while the important part is squeezed at the edge.
- **Judge the silhouette first.** Shrink the frame to thumbnail size in your head: the subject, its support and the empty space should make one picture.

## Type

- **Real sizes:** 13 to 15px for UI text, 12px minimum for secondary labels, one larger size for the focal value.
- **Line height at least 1.3** for small text; a title over its subtitle sits 4 to 6px apart and reads as one item.
- **Declare the font on the root.** The host container is `all: initial`; nothing inherits from the page.
- **Tabular numbers** for anything that changes or aligns: `font-variant-numeric: tabular-nums`.
- **A value and its unit keep a gap:** a real space, or `margin-left: 0.25em` on the unit span.
- **Fit the text before fixing the box.** A button's text never touches its border; check the longest prop value you allow, not just the default.
- **Truncate on purpose.** Long user text gets `overflow-wrap: anywhere` or a single-line ellipsis, never an overflow out of its box.

## Spacing and alignment

- **Insets:** 12px from text to any surface edge, 16px for the component's outer padding when it has a surface.
- **Gaps are fixed** (`gap: 8px` to `12px`), never leftover `space-between` that changes with width.
- **Near-tangents are bugs.** Edges 1 to 3px apart look accidental: align them exactly or separate them by at least 8px.
- **Nested shapes pad evenly**, and the outer radius equals the inner radius plus the padding.
- **Columns line up.** Rows of a list share one grid template with fixed tracks.
- **Group by proximity.** A label sits closer to its value than to the next item.
- **Center on the visible glyphs.** A currency sign or unit hangs outside the centered digits.

## Color

- **Tokens, defined once** at the root with `light-dark()`:
  - `--fg`, `--fg-muted`, `--fg-faint` for text
  - `--surface`, `--surface-raised`, `--line` for grounds and hairlines
  - `--accent`, `--accent-fg` for the one emphasized thing
- **Quiet is not faint.** Muted text still passes contrast on both themes.
- **Dark depth comes from a lighter surface**, not a shadow.
- **Status colors mean status.** Green is not decoration.
- **Nothing translucent overlaps** other content; overlapping things get opaque fills.
- **No focus-ring halos as emphasis.** Emphasize the focal object with size, weight or the accent, not a glowing ring. Real focus rings are for keyboard focus only (`:focus-visible`).

## Charts

- **SVG text scales with its `viewBox`.** A 600-unit-wide `viewBox` drawn at 340px shrinks 11px labels to 6px; with `preserveAspectRatio="none"` text also stretches. Either measure the container with a `ResizeObserver` and set the `viewBox` width to the real pixel width (redraw on resize), or keep the SVG for marks only and put labels in HTML positioned over it.
- **Reserve room for labels.** Axis labels, the chart's label and the plot never share space: give the plot padding on the side where labels sit, and keep the chart's own label outside the SVG.
- **Few ticks.** Two or three labeled values per axis; the start, the end and one meaningful point.
- **Label the line, not a legend.** Put the series name or end value next to the end of the line.
- **One series in the accent.** A second series is `--fg-faint` or dashed, never a second bright color.
- **Area fills are flat and faint** (`color-mix(in srgb, var(--accent) 12%, transparent)`), not gradients.

## Icons and imagery

- **Most components need no icons.** Add one only where a word would be worse.
- **Copy, never draw.** Inline the SVG path of a real icon set at 16px with one stroke width throughout. A hand-drawn glyph never matches its neighbors.
- **No sparkle, wand or star for "AI", no emoji as icons, no invented logos.**
- **Real imagery or none.** No placeholder illustrations.

## Controls

- **Real elements:** `button`, `input type="range"`, `select`, `label`. Style them; do not rebuild them from `div`s.
- **A control hugs its content** and sits next to what it changes.
- **Rest state is visible:** a button has a surface or border at rest, not only on hover.
- **Active state is a solid step** (filled with `--accent`, or `--surface-raised` plus weight), not a translucent wash.
- **Hit targets** at least 28px tall on desktop, 36px when the frame is narrow.
