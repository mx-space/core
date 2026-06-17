# Task 5 — Admin post write Skill picker

## Scope (in)

Add a dedicated "Skill picker" UI element to the post write meta panel in `apps/admin`. The author selects one or more `SnippetType.Skill` rows from a searchable combobox; selections persist as `meta.skillIds: string[]` on the post.

### 5a. New file `apps/admin/src/features/write/components/SkillPicker.tsx`

A self-contained component exported as `SkillPicker`. Props:

```ts
interface SkillPickerProps {
  value: string[]                // current meta.skillIds (snowflake strings)
  onChange: (next: string[]) => void
}
```

Behavior:

- On mount, fetch the skill list once via TanStack Query:
  ```ts
  const skillsQuery = useQuery({
    queryFn: () => getSnippets({ type: SnippetType.Skill, size: 200 }),
    queryKey: ['snippets', 'skills'],
    staleTime: 60_000,
    select: (res: any) => Array.isArray(res?.data) ? res.data : [],
  })
  ```
  Use `getSnippets` from `~/api/snippets`. `size: 200` is an MVP cap — the author likely has fewer than 200 skills. If the page is ever full, surface no warning (out of scope).

- Build a `Map<string, SnippetModel>` from the fetched list so the pill rendering can look up selected items by id in O(1).

- Render layout (top-to-bottom):
  1. A row of **selected pills**. Each pill: skill `name` in `font-mono text-xs`, surface `bg-accent-soft`, fg `text-accent`, `rounded-full px-2 py-0.5`. A trailing `×` button (lucide `X`, `size-3`) removes the pill (calls `onChange(value.filter(id => id !== removed))`). When a selected id has NO matching fetched skill (stale or deleted), render the pill with the id itself in `text-fg-subtle` and a hover tooltip `Skill no longer available`.
  2. A **Combobox** (using `~/ui/primitives/combobox`) below the pill row. Items source: the fetched skills minus already-selected ones. Item label = skill `name`; item secondary line = skill `comment` (description). On select, call `onChange([...value, picked.id])` and clear the combobox input.
  3. When the query is loading, the combobox shows a loading state (spinner + "Loading..." text). When the fetched list is empty, the combobox shows a no-results state — message "No skills yet — create one under Snippets."
  4. Below the combobox, a tiny help line: `Readers will see attached skills as cards above the article body, with a one-line install command.` Use `text-xs text-fg-muted`.

- Visual frame: the whole component wraps in a `grid gap-2` container with NO outer border (it will be embedded in a PanelBlock that already provides the chrome).

### 5b. Wire into `WriteRouteViewsContent.tsx`

In `apps/admin/src/features/write/components/WriteRouteViewsContent.tsx`:

- Locate the existing meta `<PanelBlock icon={Braces} title={t('write.section.image.metaTitle')}>` (currently around line 2451 — it wraps `MetaPresetSection` for posts/notes and `MetaJsonField` for pages).
- Add a NEW `<PanelBlock>` directly ABOVE that meta block, ONLY when `props.kind === 'post'`. Use the `Sparkles` icon from `lucide-react`. Title: `t('write.section.skill.title')`.
- Inside it, render `<SkillPicker value={...} onChange={...}>` where:
  - `value`: read `props.state.meta.skillIds` if it's an array of strings, else `[]`. Defensive coerce.
  - `onChange`: writes via `props.updateField('meta', { ...props.state.meta, skillIds: next })`. If `next.length === 0`, OMIT the `skillIds` key entirely from `meta` (don't store `skillIds: []`).

The SkillPicker is post-only in v1. Notes and pages do not get the section.

### 5c. i18n keys

Add to BOTH `apps/admin/src/i18n/resources/en-US.ts` and `apps/admin/src/i18n/resources/zh-CN.ts`:

- `write.section.skill.title` — "Skill attachments" / "关联 Skill"
- `write.section.skill.placeholder` — "Search a skill..." / "搜索 skill..."
- `write.section.skill.empty` — "No skills yet — create one under Snippets." / "尚无 skill，先去 Snippets 创建。"
- `write.section.skill.helper` — "Readers will see attached skills as cards above the article body, with a one-line install command." / "读者将于文章上方见到关联 skill 之卡片与一行 install 命令。"
- `write.section.skill.removeAria` — "Remove skill {name}" / "移除 skill {name}"
- `write.section.skill.unavailable` — "Skill no longer available" / "Skill 已不可用"
- `write.section.skill.loading` — "Loading..." / "加载中..."

### 5d. Type plumbing for `meta.skillIds` (if needed)

The `WriteFormState.meta` type is `MetaRecord` (a freeform record). `meta.skillIds` doesn't need a typed field — it lives as a freeform key. Verify the TypeScript flow accepts the read/write pattern; if there's a strict check that rejects `meta.skillIds`, escalate as NEEDS_CONTEXT — do NOT fight the type system here.

## Scope (out)

- No backend changes (Tasks 1–3 done; backend already reads `meta.skillIds`).
- No `<SnippetEditor>` changes (Task 4 done).
- No Yohaku changes.
- No new API endpoint — reuse `getSnippets({ type: SnippetType.Skill })`.
- No multi-skill drag-reorder UI in v1 — order follows insertion order (the array).
- No bulk-attach affordance.
- No "create a skill from here" inline modal — the picker only selects existing skills.
- No telemetry, no analytics events.

## Exact values

- Pill className: `inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent`
- Pill remove button className: `inline-flex h-3 w-3 items-center justify-center rounded-full text-accent/70 hover:text-accent`
- Helper line className: `text-xs text-fg-muted`
- `getSnippets` page size cap: `size: 200`
- TanStack Query `queryKey`: `['snippets', 'skills']`
- TanStack Query `staleTime`: `60_000`
- Section icon: `Sparkles` from `lucide-react`

## Conventions you MUST follow

- See `apps/admin/CLAUDE.md` — Design System v2 tokens MANDATORY: `bg-surface-card`, `bg-surface-inset`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-border`, `bg-accent-soft`, `text-accent`, `rounded-lg`/`rounded-full`, `shadow-sm`. NO raw `bg-white`, NO `text-gray-*`, NO arbitrary text sizes like `text-[11px]`.
- ZERO new comments, ZERO new JSDoc. Allowed only for UNEXPECTED behavior. Self-audit before saving.
- camelCase end-to-end.
- Match the existing `MultiSelectField` / `TagsInput` pattern in `meta-presets.tsx` for pill rendering — read it once, then implement consistently.
- Use Base UI's `Combobox` primitive via `~/ui/primitives/combobox` — match the wrapper exposed by the codebase. Read `apps/admin/src/ui/primitives/combobox.tsx` once to understand the export shape.

## Tests

- No component test required (admin convention).
- IF a pure helper function appears in `SkillPicker.tsx` (e.g. `dedupeSelected`, `findSelectedRows`), extract it to `apps/admin/src/features/write/components/skill-picker.utils.ts` and add a small `skill-picker.utils.test.ts` covering edge cases. Otherwise no test file is needed.
- Run `pnpm -C apps/admin run lint && pnpm -C apps/admin run typecheck` before commit.

## Commit guidance

ONE commit on `feat/post-skill-attachment`:

```
feat(admin): add Skill picker to post write meta panel

Authors can now attach SnippetType.Skill rows to a post via a dedicated
picker that surfaces above the generic meta presets section. Selected
skills persist as meta.skillIds: string[]. The picker fetches skills
once per session via TanStack Query, renders selections as removable
pills, and offers a searchable combobox for adding more. Visible only
on posts.
```

No AI co-authorship trailer.

## Pre-flight notes

- Tasks 1–4 are merged on `feat/post-skill-attachment` (HEAD `b7b303e`).
- `SnippetType.Skill = 'skill'` is the enum value.
- The post detail endpoint already projects `data.skills` from `meta.skillIds` (Task 3 wiring) — your picker writes `meta.skillIds` and the reader-facing flow is closed.
- The post write panel uses `WriteFormState.meta: MetaRecord` (freeform). Be defensive: `Array.isArray(meta.skillIds) ? meta.skillIds.filter(v => typeof v === 'string') : []`.

## When you're in over your head

STOP and escalate (BLOCKED or NEEDS_CONTEXT) when:
- `WriteFormState.meta` typing fights `skillIds: string[]` writes and requires structural changes
- `~/ui/primitives/combobox` doesn't expose a paginated/async-friendly shape and you'd need to rewrite the wrapper
- The `PanelBlock` API doesn't accept conditional rendering and you'd need to refactor it
