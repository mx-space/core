# Afilmory Insert Dialog — UX Redesign

**Date:** 2026-06-06
**Scope:** `apps/admin/src/vendor/rich-editor/extensions/afilmory/InsertAfilmoryDialog.tsx`
**Status:** Approved — pending implementation plan

## Problem

The current Insert-afilmory dialog conflates too many concerns in one flat surface:

- Gallery base URL input
- Title + caption inputs
- `list / filter` mode toggle
- Layout toggle (grid / masonry / carousel)
- Facet chips (tags, cameras, lenses)
- Search + date-range inputs
- Selection counter
- Photo list

All nine blocks render simultaneously. The result is dense, scrollable, and forces a premature mode choice (`list` vs `filter`) before the user has explored the gallery. Filter UX in particular suffers: facet chips can overflow, the search/date inputs are visually orphaned beneath the chip cloud, there is no active-filter summary, no `clear all`, dates are unvalidated text, and the photo list is shown as a vertical list of rows rather than the visual grid the user expects from a photo picker.

## Goals

1. **Reduce surface area** at rest — show the photo browser as the hero; everything else is progressive.
2. **Defer mode choice** — let the user explore freely; the `list` vs `filter` source kind is derived from what they did at submit time, not from a toggle.
3. **Visual-first photo picking** — grid of thumbnails, not a list of rows.
4. **Filter UX that scales** — facets in a popover, active-filter summary inline, native date pickers, `clear all`.
5. **One CTA** — smart-labeled by state.

## Non-goals

- Server-side filtering. We continue to load the full manifest and filter client-side.
- Replacing the underlying `AfilmorySource` schema. The wire-level `{ kind: 'list', ids }` / `{ kind: 'filter', filter }` discriminator stays as-is; only the surface that produces it changes.
- Supporting search-as-command syntax (`camera:fuji`, `2024-08`). Search is plain free-text over id/title/description.
- Mobile redesign. The dialog targets the existing `min(95vw, 56rem)` width.

## Design

### Visual structure (top to bottom)

```
┌────────────────────────────────────────────────────────────────┐
│  Insert afilmory  ·  innei.afilmory.art ✎                   ✕ │  ← Header bar
├────────────────────────────────────────────────────────────────┤
│  ⌕ search id, title, description…           ⚙ Filters ●3      │  ← Search bar + filter trigger
│  [#japan ✕] [#street ✕] [📷 Fuji X-T5 ✕]      ⊗ clear        │  ← Active filter row (only when any)
├────────────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                          │
│  │ ▓✓ │ │ ▓  │ │ ▓✓ │ │ ▓  │ │ ▓  │   ← Photo grid (hero)    │
│  └────┘ └────┘ └────┘ └────┘ └────┘                          │
│  ┌────┐ ┌────┐ ┌────┐                                         │
│  │ ▓✓ │ │ ▓  │ │ ▓  │                                         │
│  └────┘ └────┘ └────┘                                         │
├────────────────────────────────────────────────────────────────┤
│  3 selected · 23 / 410 match                                  │  ← Status bar (sticky)
├────────────────────────────────────────────────────────────────┤
│  ▸ Display options  (title · caption · layout: grid)          │  ← Collapsed accordion
├────────────────────────────────────────────────────────────────┤
│  ☐ Keep live                  [Cancel]   [Insert 3 photos]    │  ← Footer
└────────────────────────────────────────────────────────────────┘
```

### Two states for the URL

**Empty** — the dialog opens as a connect surface. A centered card with a URL input and a `Recent:` list of remembered hosts (sourced from `readLastBaseUrl()` and any future multi-entry storage; for v1 it is just the single most-recent value). No photo grid, no filter chrome, no search bar. Footer shows only `Cancel` and `Continue`; pressing `Continue` or `Enter` in the URL field commits the URL and transitions to the browse state (which triggers the existing `useAfilmoryManifest` query). The `Continue` button is disabled when the URL is empty.

**Set** — the URL collapses into a header breadcrumb: `Insert afilmory · innei.afilmory.art ✎`. Clicking the pencil icon swaps the breadcrumb for an inline editable input; pressing Enter or blurring re-collapses. This recovers vertical space for the grid.

### Search bar

Always visible when a URL is set. Plain free-text input. Filters by id, title, description, case-insensitive substring. Pressing Escape clears.

### Filters popover

Trigger: `⚙ Filters` button, right-aligned in the search row. Shows a count badge (`●N`) when any filter is active.

Popover content:

- **Tags** group with a segmented `any / all` control (replaces the underlined `union / intersection` link). Chips are sorted by count desc, capped at top 12 with a `+ show N more` toggle.
- **Cameras** group, same chip layout, no any/all toggle (set semantics is always `any`).
- **Lenses** group, same.
- **Date range** with two `<input type="date">` controls labeled `From` and `To`.
- **Clear all** action in the popover header.

Dismissal: click outside, press Escape, or click the trigger again.

Use the project's existing popover primitive from `~/ui/feedback/` (whichever Base UI Popover wrapper the admin already uses); do not introduce a new one. The trigger is right-anchored.

### Active filter row

Renders directly below the search bar **only** when at least one filter is active. Each active facet shows as a removable chip (`[#japan ✕]`). The row's right edge has `⊗ Clear` which clears all filters. The `any / all` toggle is duplicated here as a compact segmented control when 2+ tags are active, so the user does not need to reopen the popover.

### Photo grid

Replaces the current list-of-rows. Specifics:

- 5 columns at the modal's default width; uses CSS `grid-template-columns: repeat(5, 1fr)` so it stays responsive.
- Each cell is `aspect-square`, `object-cover`, `rounded-md`.
- Selected state: overlay tint at `accent / 20%`, plus an `✓` badge top-right at `accent` background.
- Hover state: shows a small floating card (using the existing tooltip/popover primitive — same one as the filter popover) anchored to the cell with id, date, title, description, and the existing `formatExifLine` output. Tooltip body reuses what `PhotoListRow` renders today.
- Clicking the cell toggles selection. No separate checkbox.
- Lazy-load images (`loading="lazy"`), preserve `decoding="async"` and `draggable={false}` from the current row implementation.

Filtering hides non-matching cells (the grid renders only `visiblePhotos`). Selection survives filter changes — the user can select photo A, narrow the filter, and A remains selected even if not currently visible.

### Status bar

Single line, sticky between grid and display accordion. Format:

- `N selected · X / Y match` when filter is active.
- `N selected · Y photos` when no filter is active.
- `0 selected · Y photos` when nothing selected.

### Display options accordion

Collapsed by default. Summary line shows current values: `▸ Display options (title · caption · layout: grid)`. When values are empty, summary shows `▸ Display options`.

Expanded body:

- Title input (two-column row with caption).
- Caption input.
- Layout toggle (unchanged: grid / masonry / carousel).

### Footer

- `☐ Keep live` checkbox on the left. Disabled when N > 0 selected (a list source is intrinsically a snapshot). Tooltip on disabled: "Clear selection to use a live filter."
- `Cancel` button.
- Primary CTA — single button, smart-labeled per the state table below.

### CTA state machine

| Selected | Filter active | Keep live | CTA label              | Submits as |
|---------:|--------------:|:---------:|:-----------------------|:-----------|
|        0 |             — | ☐         | `Insert` (disabled)    | —          |
|        0 |             ✓ | ☐         | `Insert as filter`     | `filter`   |
|        0 |             ✓ | ☑         | `Insert as live filter`| `filter`   |
|        N |             — | ☐         | `Insert N photos`      | `list`     |
|        N |             ✓ | ☐ (disabled)| `Insert N photos`    | `list`     |

Rules:

1. Any selection → `list` source; filter ignored at submit.
2. No selection + filter active → `filter` source.
3. No selection + no filter → CTA disabled.
4. `Keep live` is purely a label modifier; the wire payload is identical (`source.kind === 'filter'`). The wording exists because users mentally distinguish "one-time match" from "live gallery", even though the resulting embed behaves the same — it always re-evaluates the filter at render time.

> **Note:** Because the `filter` source kind is always re-evaluated at render, the `Keep live` checkbox does not change behavior. We keep it for UX clarity and to leave a hook for a future "snapshot the current matches as a list" action. If we decide we do not want to surface this distinction at all, drop the checkbox and just label the button `Insert as filter`. Decide before implementation.

## State model

```ts
interface DialogState {
  // URL pane
  baseUrl: string
  editingUrl: boolean

  // Filters (always tracked; rendered when popover open or active row visible)
  filter: PhotoFilter           // existing shape
  filterPopoverOpen: boolean

  // Selection (sticky across filter changes)
  selectedIds: string[]

  // Display options
  displayExpanded: boolean
  title: string
  caption: string
  layout: AfilmoryLayout

  // Submit intent
  keepLive: boolean
}
```

Derived values:

- `visiblePhotos` = `applyClientFilter(allPhotos, filter)` (existing helper).
- `selectedSet` = `new Set(selectedIds)` (existing).
- `activeFilterCount` = number of populated keys in `pickerFilterToSource(filter)`.
- `submitMode`: `selectedIds.length > 0 ? 'list' : (activeFilterCount > 0 ? 'filter' : 'none')`.
- `ctaDisabled` = `submitMode === 'none'`.
- `keepLiveDisabled` = `selectedIds.length > 0`.

The existing `EMPTY_FILTER`, `applyClientFilter`, `deriveFacets`, `pickerFilterToSource`, `sourceFilterToPicker`, `toggleArray`, `formatExifLine`, `formatDateShort`, `readLastBaseUrl`, `rememberBaseUrl`, `normalizeBaseUrl` helpers all stay. We delete the `DialogMode` type and the `mode` state.

## Component boundaries

The current file is ~500 LoC and mixes layout, filter chrome, list rendering, and state into one component. The redesign breaks it into focused units that fit the project's "small, well-bounded" rule:

```
InsertAfilmoryDialog.tsx           (orchestrator, ~120 LoC)
  ├── ConnectPane.tsx               (empty-URL state)
  ├── UrlBreadcrumb.tsx             (collapsed/editable URL)
  ├── PhotoGrid.tsx                 (grid + selection + tooltip)
  │   └── PhotoGridCell.tsx         (single thumb + hover card)
  ├── FilterBar.tsx                 (search input + ⚙ trigger + active row)
  ├── FilterPopover.tsx             (facet groups + date range + clear-all)
  ├── StatusBar.tsx                 (counter line)
  ├── DisplayOptions.tsx            (accordion: title/caption/layout)
  └── DialogFooter.tsx              (Keep live + Cancel + CTA)
```

Each child is < 200 LoC. Existing `picker-helpers.tsx` keeps its exported helpers. `ChipButton`, `FacetGroup`, `TagModeToggle` continue to be reused inside `FilterPopover`. `PhotoListRow` is deleted (replaced by `PhotoGridCell`).

## Tokens & primitives

- Surfaces use `bg-surface-card` (header, footer), `bg-surface-page` (grid backdrop), `bg-surface-overlay` (filter popover).
- Borders: `border-border` for separators, `border-border-strong` for active chip outlines.
- Accent: `bg-accent` for selected overlay (at `/20` opacity), CTA, focus ring (`focus-visible:ring-[3px] focus-visible:ring-accent/15`).
- Typography: status bar `text-xs`, breadcrumb `text-sm`, grid tooltip `text-xs`. No arbitrary sizes.
- Radii: `rounded-md` thumbnails, `rounded-lg` popover, `rounded-sm` chips and inputs.
- Avoid `text-[10px]` etc. that the legacy code uses.

Primitives reused from `~/ui/`:

- `TextInput` for URL / title / caption.
- `Button` for footer actions.
- `Checkbox` for the `Keep live` toggle.
- Existing popover wrapper for `FilterPopover` and grid hover card (whichever Base UI Popover wrapper the admin already uses).

If the admin already exposes a DateRangePicker, use it. Otherwise the `<input type="date">` pair is the fallback — confirm at implementation time. Do not introduce a new dependency.

## Submit logic

```ts
function buildPayload(): AfilmoryPayload | null {
  if (!baseUrl) return null

  const normalizedUrl = normalizeBaseUrl(baseUrl)
  rememberBaseUrl(normalizedUrl)

  let source: AfilmorySource
  if (selectedIds.length > 0) {
    source = { ids: selectedIds, kind: 'list' }
  } else {
    const f = pickerFilterToSource(filter)
    if (Object.keys(f).length === 0) return null
    source = { filter: f, kind: 'filter' }
  }

  return {
    accent: props.initial?.accent,
    alt: props.initial?.alt,
    baseUrl: normalizedUrl,
    caption: caption.trim() || undefined,
    layout,
    source,
    title: title.trim() || undefined,
  }
}
```

Identical to today's `submit()` minus the `mode` branch. The mode is implicit in `selectedIds.length`.

## Editing existing blocks

When `props.initial` is provided:

- If `initial.source.kind === 'list'` → preselect the ids; the user lands directly in the grid view. Filter is empty.
- If `initial.source.kind === 'filter'` → preload the filter, leave selection empty, open the active-filter row. `Keep live` defaults to checked since the existing block is a filter source.
- Title/caption/layout always preload into the (still collapsed) display options. If any field is non-empty, the accordion header summary reflects it.

## Empty / loading / error states

Reuse the existing branches verbatim:

- No URL → connect pane (special case, replaces the whole dialog body; footer also swaps from `Insert` to `Continue`).
- Loading manifest → centered spinner with `Loading manifest…`.
- Manifest error → centered `manifestQuery.error.message` text.
- Manifest empty → `Manifest empty.` text.
- Filter matches none → `No photos match the current filter.` text inside the grid area.

These messages live inside the photo-grid pane, not the dialog root, so the header/search/footer stay visible.

## Out of scope (future work)

- Server-side pagination of large manifests.
- Bulk-select shortcuts (shift-click range, "select all visible").
- Saved filter presets.
- A "snapshot live filter to list" action.
- Search command syntax (`camera:fuji`, `before:2024-09`).

## Open questions resolved during brainstorming

- **Q1** (EXIF visibility in grid): hover popover card per cell.
- **Q2** (DateRangePicker): use existing admin component if available; native `<input type="date">` otherwise. Verify at implementation.
- **Q3** (command search syntax): rejected as nerdy; plain free-text only.
- **Facet count semantics**: chip counts stay tied to the full manifest (current behavior). Live-recomputing per-filter counts is rejected to avoid flicker.
- **`Keep live` necessity**: kept for now; flagged for re-evaluation in the implementation review. If it adds no behavior, we may drop it before merging.

## Acceptance criteria

1. Dialog renders the connect pane when `baseUrl === ''`.
2. With a base URL, the photo grid (5 cols, aspect-square) is the dominant surface.
3. There is no `list / filter` mode toggle anywhere in the UI.
4. Filter popover opens from the `⚙ Filters` trigger; closes on outside-click, Escape, or trigger re-click.
5. Active filters appear as removable chips below the search bar; `Clear all` resets all filter fields.
6. Selecting any photo and submitting produces an `AfilmoryPayload` with `source.kind === 'list'`.
7. Without selection, an active filter and submit produces `source.kind === 'filter'`.
8. With both, selection wins and filter is dropped from the payload.
9. Editing an existing block roundtrips: a `filter` source preloads filter fields; a `list` source preloads selected ids.
10. Title / caption / layout work identically to today; the `AfilmoryPayload` shape on submit is byte-for-byte the same as the current implementation for equivalent inputs.
11. No new third-party dependencies introduced.
12. All child components < 200 LoC.
