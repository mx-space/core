# Admin UI Softening — Design System v2

**Date:** 2026-05-30
**Scope:** `apps/admin` (React 19 SPA, `@mx-admin/admin`)
**Status:** Spec — awaiting implementation plan

## Motivation

The current admin UI follows a Vercel/Linear-inspired minimal aesthetic: cool neutral
grays (`neutral-200`/`neutral-800`), small radii (`rounded` = 4px on modals and inputs),
hairline solid borders, bright cyan-blue primary (`#1a9cf3`), and an engineering-flavored
font stack (`Segoe UI`/`Helvetica Neue`). The look is precise and dense, but the high
contrast and sharp corners read as "geeky" and impersonal.

mx-space targets a general-purpose blog/CMS audience, not engineers exclusively. The UI
needs to feel approachable and content-focused without sacrificing the operator-grade
density that the admin's list-heavy surfaces depend on.

This spec defines a **Design System v2** that retunes tokens, typography, and component
shapes toward a Notion-inspired warm aesthetic while keeping list/table density intact.

## Design Decisions (brainstorm outcomes)

| Dimension | Choice | Rationale |
|---|---|---|
| Overall direction | A3 — Notion-warm (warm stone palette, larger radii) | Friendliest for general audience while staying professional |
| Density policy | Scene-based: lists/tables keep current density; cards/forms/empty-states relax | Preserves operator efficiency on dense surfaces, softens content surfaces |
| Primary accent | Warm blue `#2563eb` (cobalt) | One-token swap, no migration cost, agrees with warm palette, retains scannability |
| Typography | Inter (self-hosted Latin subset, ~80KB) | Cross-platform consistency, admin standard |
| Dark mode | Hybrid: neutral×stone middle (`#100f0e` shell) | Keeps high contrast for ops use, warms slightly to mirror light side |
| Rollout | Full Design System v2 (token + primitives + patterns + polish) | Long-term foundation; can document and reuse |

## Section 1 — Surface Stack and Color Tokens

Three-layer surface model replaces the current `bg-white` / `bg-neutral-950` flat scheme.

### Surface layers

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--surface-page` | `#faf9f7` | `#100f0e` | Outer shell, html background |
| `--surface-card` | `#ffffff` | `#1a1816` | Primary content containers |
| `--surface-inset` | `#f5f4f1` | `#0a0908` | Code blocks, empty states, quotes, in-card panels |
| `--surface-overlay` | `#ffffff` | `#22201d` | Popovers, dropdowns, tooltips |

### Text tokens

All foreground tokens live in the Tailwind v4 `--color-*` namespace so they
generate `text-fg`, `text-fg-muted`, `text-fg-subtle` utilities. The bare
`--text-*` namespace is reserved by Tailwind v4 for font-size tokens and must
not be reused for colors.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-fg` | `#37352f` | `#fafaf9` | Main copy |
| `--color-fg-muted` | `#787774` | `#a8a29e` | Labels, sub-copy |
| `--color-fg-subtle` | `#9b9a97` | `#78716c` | Placeholders, disabled |

### Border tokens (rgba-based for soft hairlines)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` | Card edges, inputs, dividers |
| `--color-border-strong` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` | Hover, active, focus |

### Accent tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-accent` | `#2563eb` | `#3b82f6` | Links, focus ring, primary CTA |
| `--color-accent-hover` | `#1d4ed8` | `#2563eb` | Hover states |
| `--color-accent-soft` | `#eaf0ff` | `rgba(59,130,246,0.12)` | Selected row tint, soft accent fills |

The existing `--color-primary` / `--color-primary-shallow` / `--color-primary-deep`
remain as **aliases** pointing at the new accent palette during the transition (to
avoid touching every existing reference). New code uses `--color-accent`.

Dark-mode overrides live in a `.dark { … }` block (specificity 0,1,0) rather
than `:where(.dark)` (specificity 0). The `:where()` form would lose to the
`:root` declarations generated from `@theme`, leaving dark tokens inert.

Theme tokens are CSS-only — `installThemeTokens` writes only the legacy
`--color-primary*` aliases (which have no dark CSS counterpart and therefore
do not collide with the dark cascade). All new `--color-accent*` /
`--color-fg*` / `--color-border*` / `--color-surface-*` values come from
`tokens.css` and the `.dark` override block.

## Section 2 — Radii, Shadow, Spacing Scales

### Radii (5-step + pill)

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px | Tiny chips |
| `--radius-sm` | 8px | Buttons, inputs, dropdown items |
| `--radius-md` | 10px | List rows, code blocks, large inputs |
| `--radius-lg` | 12px | Cards, modals, drawers, popovers |
| `--radius-xl` | 14px | Empty states, hero cards |
| `--radius-pill` | 999px | Status pills, tags, badges |

The Tailwind utility mapping is updated so `rounded-sm` → 8px, `rounded-md` → 10px,
`rounded-lg` → 12px, etc. Existing component classnames stay; only the token values
change. This is the primary mechanism that lets PR 1 shift the look globally without
component edits.

### Shadows (4-step)

| Token | Value | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Input rest, ghost lift |
| `--shadow-sm` | `0 1px 0 rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.06)` | Cards, panels |
| `--shadow-md` | `0 4px 12px -2px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Popovers, dropdowns |
| `--shadow-lg` | `0 12px 32px -8px rgba(15,23,42,0.18), 0 2px 8px -2px rgba(15,23,42,0.08)` | Modals, drawers |

### Spacing — dual-track

| Surface type | Current | New |
|---|---|---|
| List row | py-2 (8px) | py-2 unchanged — preserve density |
| Input default | h-10 (40px) | h-9 (36px) + radius-sm |
| Button default | h-8/h-9 + rounded-md | h-9 + radius-sm |
| Card padding | p-3 (12px) | p-5 (20px) |
| Modal padding | p-4 (16px) | p-6 (24px) |
| Empty-state padding | varied | p-10 + radius-xl |
| Form field gap | gap-3 | gap-4 (16px) |
| Section gap | varied | gap-6 (24px) |

### Tailwind v4 integration

All tokens enter via `@theme` in a new `src/styles/tokens.css`:

```css
@theme {
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;

  --shadow-xs: 0 1px 2px rgb(0 0 0 / 0.04);
  --shadow-sm: 0 1px 0 rgb(0 0 0 / 0.02), 0 1px 3px rgb(0 0 0 / 0.06);
  --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 1px 2px rgb(0 0 0 / 0.04);
  --shadow-lg: 0 12px 32px -8px rgb(15 23 42 / 0.18), 0 2px 8px -2px rgb(15 23 42 / 0.08);

  --color-surface-page: #faf9f7;
  --color-surface-card: #ffffff;
  --color-surface-inset: #f5f4f1;
  /* …remaining tokens */
}
```

## Section 3 — Typography

### Scale (unchanged sizes, retuned weight/leading/tracking)

| Step | Size/leading | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-2xl` | 24 / 30 | 600 | -0.02em | Page title |
| `text-xl` | 20 / 26 | 600 | -0.015em | Section title |
| `text-lg` | 18 / 24 | 600 | -0.01em | Card/modal title |
| `text-base` | 16 / 25 | 400 | 0 | Lead paragraphs, emphasized body |
| `text-sm` | 14 / 22 | 400 | 0 | Body, list, form labels |
| `text-xs` | 12 / 18 | 500 | 0 | Meta, pills, timestamps |

### Root font-size correction

**Current:** `apps/admin/src/index.css` line 37 sets `font-size: 14px !important` on
`body, html`. Under Tailwind v4 rem-based sizing, this collapses the scale (`text-base`
= 14px, `text-sm` = 12.25px) which is inconsistent with `apps/admin/CLAUDE.md`'s
documented sizes.

**New:** Remove the override. Root returns to 16px. `text-sm` resolves to its
documented 14px for body copy.

### Body-text migration

Files currently using `text-base` for body content must migrate to `text-sm` to keep
14px body text after the root change. The audit (`grep -rE "(^|[\"' ])text-base"`)
shows 18 files with 18 occurrences total:

```
apps/admin/src/features/comments/components/CommentDetail.tsx (×2)
apps/admin/src/features/write/components/WriteRouteViewsContent.tsx
apps/admin/src/features/webhooks/components/WebhookStates.tsx
apps/admin/src/features/topics/components/TopicDetailEmpty.tsx
apps/admin/src/features/settings/components/SettingsPrimitives.tsx
apps/admin/src/features/settings/components/OwnerSettings.tsx
apps/admin/src/features/says/components/SayListItem.tsx
apps/admin/src/features/recently/components/RecentlyListItem.tsx
apps/admin/src/features/readers/components/ReaderDetailHeader.tsx
apps/admin/src/features/projects/components/ProjectPrimitives.tsx
apps/admin/src/features/markdown/components/import/ParsedPreviewPane.tsx
apps/admin/src/features/enrichment/components/ProbeConsole.tsx
apps/admin/src/features/enrichment/components/CacheDetailPanel.tsx
apps/admin/src/features/comments/components/CommentPrimitives.tsx
apps/admin/src/features/categories/components/DetailEmpty.tsx
apps/admin/src/features/backup/components/BackupDetailEmptyState.tsx
apps/admin/src/features/ai/components/article-grouped/ArticleDetailPane.tsx
apps/admin/src/features/ai/components/article-grouped/ArticleDetailEmptyState.tsx
```

A separate sweep covers 4–5 arbitrary px values (`text-[11px]`, `text-[13px]`) that
CLAUDE.md already forbids; these become `text-xs` / `text-sm`.

### Feature settings

```css
:root {
  --sans-font: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei',
               'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
body { font-feature-settings: 'ss01', 'cv11'; }
.tabular { font-variant-numeric: tabular-nums; }
```

- `tabular-nums` is applied by default to timestamps, counts, prices.
- Inter `ss01` (single-story `a`) + `cv11` (straight quotes) for a more book-like feel.
- Large headings carry negative letter-spacing; small sizes stay at 0.
- Body stays at 14px (`text-sm`); we do not bump to 15px — that would hurt list density.

### Inter loading

```css
@font-face {
  font-family: 'Inter';
  font-weight: 400 600;
  font-display: swap;
  src: url('/fonts/inter-latin.woff2') format('woff2');
}
```

- Self-hosted, Latin subset, weights 400/500/600 only.
- `font-display: swap` to avoid FOIT.
- Chinese characters render via system fallback (`PingFang SC` / `Microsoft YaHei`).
- Estimated build size impact: +~80KB.

## Section 4 — Components

### 4a — Primitives

**Button** (`apps/admin/src/ui/primitives/button.tsx` and consumers)

- Three variants: `primary`, `secondary`, `ghost` (new).
- Default: `h-9`, `radius-sm`, `shadow-xs`. Primary uses `--accent` background.
- No hover color flip; instead a subtle background darken (`--accent-hover` for primary,
  `--surface-inset` for secondary/ghost).

**Input / Textarea / Select** (`apps/admin/src/ui/primitives/text-field.tsx`, etc.)

- `h-9` (was h-10), `radius-sm`, soft inner `shadow-xs` to break the bare-border feel.
- Focus ring becomes `0 0 0 3px rgba(37,99,235,0.15)` with no offset (replaces
  `ring-2 ring-offset-2` solid-frame look).
- Border uses `--border-default`; on focus switches to `--accent`.

**Modal** (`apps/admin/src/ui/feedback/modal.tsx`)

- Radius `4px → 12px` (radius-lg).
- Padding `16px → 24px`.
- Removes border, relies on `shadow-lg` for elevation.
- The pre-existing `w-[40rem]` etc. fixed widths stay (those are size-class tokens, not
  visual ones), but internal layout must be reviewed for the extra 8px padding.

**Popover / Dropdown / Drawer**

- Radius-lg outer, radius-sm inner items.
- No border; `shadow-md` for popover/dropdown, `shadow-lg` for drawer.
- Selected item gets `--accent-soft` background; hover gets `--surface-inset`.

**Focus ring (global)**

- Single rule: `box-shadow: 0 0 0 3px var(--accent) / 15%` on focus-visible.
- Remove all `ring-offset-*` usages.

### 4b — Patterns

**Sidebar nav** (`apps/admin/src/ui/layout/sidebar-*.tsx`)

- Active item: 4% black tint (instead of `neutral-100` solid).
- Right-aligned tabular count column.
- Active label weight 500 (was 400).

**List row** (consumed throughout `features/`)

- Row height bumps 32 → 34px (+2px for breathing room).
- Divider becomes `rgba(0,0,0,0.04)` (was solid `neutral-200`).
- Prefix 6px dot for status scanning (green/orange/red/gray).
- Selected row tinted with `--accent-soft`.

**Empty state** (new shared component)

- Move from inline `border-dashed` dropzones to a shared `<EmptyState />` in
  `apps/admin/src/ui/patterns/EmptyState.tsx`.
- Layout: `--surface-inset` background, `radius-xl`, an icon tile on `--surface-card`
  with `shadow-xs`, two-line copy (title + helper), primary CTA below.
- Replaces ~10 existing `*Empty*.tsx` files.

**Status pill** (new shared component)

- `apps/admin/src/ui/data/StatusPill.tsx`.
- Six semantic tones with low-chroma background + saturated text:
  - Live: `#f0fdf4` / `#166534`
  - Draft: `#fff7ed` / `#9a3412`
  - Error: `#fef2f2` / `#991b1b`
  - Scheduled: `#eff6ff` / `#1e40af`
  - Archived: `#f3f4f6` / `#4b5563`
  - Pending: `#fefce8` / `#854d0e`
- All pills use `radius-pill`, `text-xs`, weight 500.

## Section 5 — Migration Plan

Four sequential PRs, each independently shippable and revertible.

### PR 1 — Foundation (≈ 1 day, low risk)

- Add `src/styles/tokens.css` with all `@theme` declarations.
- Remove `font-size: 14px !important` from `index.css`.
- Add Inter `@font-face`; update `--sans-font` stack.
- Mechanical replace: 18 files `text-base → text-sm` per audit list above.
- Replace 4–5 arbitrary `text-[11px]` / `text-[13px]` with standard scale.
- Update `themeColors` in `apps/admin/src/theme.ts` to alias `--color-primary*` to the
  new accent tokens.
- **Risk:** root font-size change affects every rem-based value. Tailwind v4 utilities
  remain consistent (still rem-based, so `h-9` stays `2.25rem` = 36px under root 16).
  Audit for any hard-coded `rem` literals or `1em` assumptions.
- **Verification:** screenshot baseline 5 pages (Posts, Notes, Comments, Settings,
  Write editor) before/after.

### PR 2 — Primitives (≈ 2 days, medium risk)

- Refactor `src/ui/primitives/` (Button, TextField, Textarea, Select, Combobox,
  Checkbox, Switch, Radio).
- Refactor `src/ui/feedback/` (Modal, Drawer, BottomSheet, Confirm, Popover).
- Unify focus ring; remove all `ring-offset` usages.
- Replace inline shadows with `--shadow-*` tokens.
- Add Button `ghost` variant.
- **Risk:** Modals with hard-coded internal widths (`w-[40rem]`) need a layout check
  for the additional padding.
- **Verification:** add a `dev`-only `/__primitives` route aggregating every primitive
  variant for manual inspection (no Storybook dependency).

### PR 3 — Patterns (≈ 2 days, medium risk)

- Refactor sidebar (`src/ui/layout/sidebar-*.tsx`).
- Refactor `content-layout.tsx`, `page-layout.tsx`, `master-detail-shell.tsx` to use
  the surface stack tokens.
- Build `src/ui/patterns/EmptyState.tsx`; replace ~10 existing empty-state files
  across features (preserve original copy verbatim).
- Build `src/ui/data/StatusPill.tsx`; replace inline pills.
- Apply list row tweaks (height, divider color, prefix dot, selected tint).
- **Risk:** EmptyState rollout touches `backup`, `topics`, `categories`, `comments`,
  `projects`, `ai`, etc. Copy must not be auto-substituted; each call site reviewed.

### PR 4 — Polish (≈ 1 day, low risk)

- `responsive-data-table.tsx`: hook into surface tokens, add row hover tint.
- `chart.tsx` tooltip: radius `sm → md`, shadow-md, accent palette.
- Sonner toast: align to new accent tokens (current redesign retained).
- Scrollbar: warm-neutral track/thumb.
- Update `apps/admin/CLAUDE.md` with a Design System v2 section listing tokens and
  usage rules.
- Remove legacy `themeColors` constants in `theme.ts` once all references go through
  CSS variables.

### Out of scope (YAGNI)

- Storybook or visual regression CI.
- Code editor (CodeMirror / Lexical) internal styling — monospace stays, palette
  retuned later.
- i18n-specific font-size tweaks.
- Motion library / large animation overhaul.
- Mobile (`phone:`) layout redesign — current responsive rules continue.

### Verification

- Screenshot diff (manual, via Playwright) across 5 baseline pages per PR.
- Light + dark mode walkthrough every PR.
- Login and Setup screens verified first in PR 1 (every user hits them).
- `dev`-only `/__primitives` route added in PR 2 to enable quick visual sweeps without
  Storybook.

### Time budget

Roughly 6 working days total, split across 4 PRs. Allow 1–2 day intervals between PRs
for feedback collection. After completion, `apps/admin/CLAUDE.md` and a new
`docs/admin-design-system.md` capture the rules for future contributors.

## Open Questions

None at spec acceptance. Any new questions surfacing during implementation should
update this spec via amendment rather than ad-hoc decisions.

## Follow-ups (post PR4)

The final cross-PR review surfaced long-tail items that fall outside the four
planned PRs but are worth tracking. None block the DSv2 v2 cutover.

1. **Bare `rounded` (no suffix) — ~333 sites.** Tailwind's default `rounded` is
   4px and is not remapped by the DSv2 token theme; the spec's radii scale only
   binds to the explicit `rounded-{xs,sm,md,lg,xl}` utilities. Sites that still
   use the bare class therefore render with the legacy 4px corner. Decide
   between: (a) remap globally via `--radius: var(--radius-sm)` in `tokens.css`
   (risky for genuinely small chips), or (b) sweep `rounded` → `rounded-sm` in
   `apps/admin/src/features/**`. Prefer (b) on a per-feature basis as those
   areas get touched.
2. **features/dashboard cards.** `DashboardPrimitives`, `ActionCard`,
   `SearchIndexRebuildCard`, `TrafficPanel` still use
   `bg-white dark:bg-neutral-950`. Migrate to `bg-surface-card` to exercise the
   three-layer surface stack on the dashboard.
3. **Other `bg-white` shells.** `apps/admin/src/ui/primitives/panel.tsx`,
   `code-editor.tsx` outer chrome (the editor inner styling stays per the YAGNI
   list), and a handful of feature page shells (`features/snippets`,
   `features/markdown`, `features/drafts`, `features/comments/CommentDetail`,
   parts of `features/write`) still use raw white/neutral background pairs.
4. **`features/_shared/components/content-list-toolbar.tsx`** has had its sort
   popover migrated to tokens; the row toolbar itself is still legacy and is
   the next obvious target.
5. **Pre-existing typecheck error** at
   `apps/admin/src/hooks/use-document-title.tsx:36` (`string | undefined` vs
   `string | null`) is unrelated to DSv2 but blocks `tsc --noEmit`. Fix
   alongside any unrelated hooks change.
6. **Inter self-hosting.** PR1 loaded Inter via Google Fonts CDN to keep the
   diff binary-free. The long-term plan in §3 is a self-hosted Latin subset.
7. **Sidebar count column.** The render code is in place; the
   `virtual:admin-routes` model lacks a count field. Plumb counts (unread
   comments, pending subscribers, active AI tasks) when the route model grows.
8. **Spec shorthand cleanup.** Earlier sections of this document use the
   pre-rename shorthand (`--border-default`, `--accent`); the actual tokens
   live in the `--color-*` namespace. The §1 token tables and the §3 follow-on
   addendum carry the authoritative names; leave the older shorthand in place
   only where they reference the design intent rather than the implementation.
