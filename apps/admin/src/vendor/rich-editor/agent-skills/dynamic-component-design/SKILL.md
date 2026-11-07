---
name: dynamic-component-design
description: Design rules for writing or revising an interactive component stored at /embeds/<id>.js. Load before writing any component source, including small fixes to how one looks.
---

# Dynamic component design

A dynamic component is a figure inside an article. The reader is reading prose, scrolls onto it, and should understand in a glance what it shows, then explore by touching it. It is not an app, a dashboard or a landing page.

## The one idea

**One lead, its supporting facts quieter, complete before anyone touches it, and every change has a cause.**

Restraint applies to decoration, not to content. Facts and data are the content: keep them, and give them a hierarchy. Decoration is everything that only frames them: eyebrows, titles restating the article, subtitles, badges, legends, helper text, footer notes.

The six ways it fails:

- **Too much decoration.** An eyebrow, a title, a subtitle, three badges and a footer note around the data. Each framing string makes it look generated.
- **Gutted.** Facts dropped to make it look calm. A quiet figure that no longer carries what the article needs is a worse figure, not a cleaner one.
- **Boxed.** A card with border, shadow, gradient header and 24px radius dropped into prose. The article is the frame; the component does not need its own.
- **Flat.** Every element the same weight, the same bordered tile. The eye has nowhere to land.
- **Dead until clicked.** An empty area with a "Click start" button. The first frame must already say what the component is about.
- **Stock AI look.** Purple or indigo gradients, sparkles, emoji as icons, glassmorphism, a letter in a colored square as a logo. None of these come from the article.

## Workflow

1. **Plan before code.** Write down, briefly: every fact the figure must carry; which one leads; how the others sit under it; the one primary interaction; the resting frame (what it shows before any input); which decoration you leave out. If you cannot name the lead, the design is not ready.
2. **Sort facts from decoration.** Facts stay and get ranked: one lead at full weight, the rest in a quieter layer (a row of small stats, secondary rows, a second view behind a control). Decoration is cut down to what the reader needs to read the data: usually 3 to 7 strings of labels and units, no restated titles, no explanatory paragraph.
3. **Build the resting frame first.** It must work as a still image: the screenshot, the RSS reader, the reader who never clicks. Pick sensible default props so this frame is the most telling state, not an empty one.
4. **Add the interaction.** One primary control, placed next to what it changes. Feedback starts on input. Changes move from the old state to the new one; nothing pops, nothing rewinds without a cause.
5. **Check before you save.** Run the checklist below against your source, then write the complete source to its file.

## Files

- Each `<dynamic>` block in `/doc.xml` names its source, for example `<dynamic id="5rIpK5hR" url="/embeds/5rIpK5hR.js" initial-height="320">`. Props stay on the block as JSON; `initial-height` stays on the block.
- `/embeds/<id>.meta.json` holds `name`, `description` (what it shows and when to use it) and `propsSchema` (a JSON Schema object; string, enum, number, integer and boolean properties with title, description and default become a form writers fill in). Keep every post-specific value in props, with sensible defaults, so the component can be reused.
- Revising: edit `/embeds/<id>.js` (and its `.meta.json` if the props change). Saving uploads a new version and proposes it; the user accepts or rejects it like any other edit, and the published article keeps the old version until it is republished. Accepted versions join the component catalog.
- Changing only `.meta.json` updates the catalog entry directly.
- A new component: write `/embeds/<name>.js` and `/embeds/<name>.meta.json` with a heredoc, then add `<dynamic url="/embeds/<name>.js" initial-height="320">{...props}</dynamic>` to `/doc.xml`. Reuse a catalog component instead, by its listed URL, whenever one fits.
- Source must be a standalone browser ES module: plain JavaScript, no JSX or TypeScript, no bare or relative imports. Default export: `{ mount(container, { props, host: { theme } }) { … return { update(input) {}, unmount() {} } } }`. Styles live inside `container` (it is in a Shadow DOM); support light and dark themes and any width.

## Revising a component

A rewrite changes presentation, not content. Before writing:

1. List every fact in the old component (each number, series, comparison and named item) and what each one tells the reader.
2. Read the article around the block in `/doc.xml`. A fact may be dropped only if the prose already states it right next to the figure; everything else stays.
3. Choose the lead from what the surrounding prose talks about, then place every other fact in the quieter layers.
4. In your reply, list any fact you dropped and why. If you would drop more than one, or the article gives no context, ask the user before dropping.

Read `/skills/dynamic-component-design/references/craft.md` for the still-frame rules and `/skills/dynamic-component-design/references/motion.md` before adding any animation. `/skills/dynamic-component-design/references/example.md` is a complete component that follows these rules; start from its structure (scoped styles, tokens, theme, cleanup) instead of a blank file.

## Fitting the article

- **Width.** The article column is about 680px wide on desktop and about 340px on a phone. Design at 680, then make sure 340 still reads: wrap, stack or drop secondary parts; never shrink type below 12px or scroll sideways.
- **Ground.** Sit on the page's ground. At most one quiet surface (`--surface`) with a 1px hairline or no border, radius 8 to 12px, no shadow.
- **Type.** The host resets the container with `all: initial`, so nothing is inherited: without a declaration the text falls back to the browser's serif. Set `font: 14px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif` on your root and `font: inherit` on every `button`, `input` and `select`. Monospace only for code and identifiers. UI text 13 to 15px, one weight step for hierarchy, sentence case. No `h1` to `h6`: a label is a `div` or `figcaption`, because the component lives inside the article's outline.
- **Color.** The host sets `color-scheme` on the container, so use `light-dark()` for every token and both themes come for free. One neutral family, one accent, status colors only for status. No gradients unless the gradient is the data.
- **Height.** Pick `initialHeight` as the resting frame's real height at 680px, so the article does not jump when it mounts.

## Checklist

- The lead is the largest, strongest thing; supporting facts are visibly quieter; nothing competes with the lead.
- When revising: every fact of the old component is on screen or in a view one control away, or named as dropped in your reply.
- Decoration is minimal: no eyebrow, no title restating the article heading, no badges, no explanatory paragraph.
- The resting frame is meaningful with no input and with JavaScript-driven motion disabled.
- Words keep at least 12px from any edge; controls keep 8px from neighbors; nothing touches and no text overlaps other text.
- A number and its unit are separated (`3 files`, `12 ms`), never `3files`.
- SVG text does not scale: no `preserveAspectRatio="none"` near text, and the `viewBox` width matches the rendered width (see craft.md, Charts).
- The root declares its font; the text is not serif unless you chose serif.
- One accent color, used on the focal object or the active control, not on decoration.
- Icons: none, or inline SVG copied from one real set (Lucide, Phosphor, Tabler) at one size and stroke. Never hand-drawn paths, never emoji.
- Works at 340px wide, in light and dark, with keyboard only (every control is a real `button`, `input` or `select` with a label).
- `prefers-reduced-motion` removes travel and keeps the end state.
- `unmount` removes every listener, timer, observer and animation frame it created.

Adapted for article components from Stageshow by Benji Taylor (MIT).
