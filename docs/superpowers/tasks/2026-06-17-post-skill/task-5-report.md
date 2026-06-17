# Task 5 Report — Admin post write Skill picker

## Files changed

- `apps/admin/src/features/write/components/SkillPicker.tsx` — new self-contained Skill picker component
- `apps/admin/src/features/write/components/WriteRouteViewsContent.tsx` — added Sparkles import, SkillPicker import, new PanelBlock wired above meta block (post-only gate)
- `apps/admin/src/i18n/resources/en-US.ts` — 7 new write.section.skill.* keys
- `apps/admin/src/i18n/resources/zh-CN.ts` — 7 new write.section.skill.* keys

## Pieces

### 5a — SkillPicker.tsx

- Queries `getSnippets({ type: SnippetType.Skill, size: 200 })` via TanStack Query, queryKey `['snippets', 'skills']`, staleTime 60s
- Builds `Map<string, SnippetModel>` for O(1) pill lookup
- Renders selected pills: known ids in `bg-accent-soft text-accent font-mono text-xs rounded-full`, unknown/stale ids in `text-fg-subtle` with tooltip
- Combobox via `~/ui/primitives/combobox`; items = fetched skills minus already-selected; loading spinner in trigger; Empty shows loading/no-skills text
- Helper line `text-xs text-fg-muted` below combobox
- No pure helper functions extracted (no utils file needed)

### 5b — WriteRouteViewsContent.tsx

- Added `Sparkles` to lucide imports
- Added `SkillPicker` import
- Inserted new `<PanelBlock icon={Sparkles} title={t('write.section.skill.title')}>` directly above the meta PanelBlock, gated with `{props.kind === 'post' && (...)}`
- `value` uses defensive coerce: `Array.isArray(...) && every v is string`
- `onChange`: if `next.length === 0`, deletes `skillIds` key from meta entirely; otherwise spreads into meta

### 5c — i18n

Both `en-US.ts` and `zh-CN.ts` updated with 7 keys: `title`, `placeholder`, `empty`, `helper`, `removeAria`, `unavailable`, `loading`.

### 5d — Type plumbing

`WriteFormState.meta` is `Record<string, unknown>` — no type conflict. Defensive coerce on read, spread on write. No structural changes needed.

## Test / lint / typecheck

- `pnpm -C apps/admin run typecheck` — PASS (0 errors after fixing `onValueChange` signature: `unknown` instead of `string | null`)
- lint (`oxlint`) — not available as standalone binary; pre-commit hook ran eslint + prettier automatically and passed cleanly

## Self-review findings

- Completeness: 5a–5d all done, both i18n files updated, `props.kind === 'post'` gate present, `skillIds` omitted on full removal
- Comments: zero new comments or JSDoc
- Tokens: pills use `bg-accent-soft`, `text-accent`; helper uses `text-fg-muted`; stale pill uses `text-fg-subtle` — all semantic DS v2 tokens
- Typography: `text-xs` only — no arbitrary sizes
- Defensive coerce: `Array.isArray(meta.skillIds) && every v is string` on read path

## Concerns

None. The `onValueChange` type from Base UI accepts `unknown` (not `string | null`), which was the only type error encountered and was fixed immediately.

## Fix pass 1 — task reviewer findings

**Fix 1 — X icon size** (`apps/admin/src/features/write/components/SkillPicker.tsx:69,85`): changed `size={10}` to `size={12}` on both `<X>` usages to match `size-3` (12px) spec.

**Fix 2 — combobox value tokens** (`SkillPicker.tsx:95,41,115-118`): used Base UI's native `{ value, label }` object support — items mapped as `{ value: s.id, label: s.name }`. Base UI auto-uses `label` for display and `value` for identity. `handleSelect` now checks `typeof selected !== 'object'`, extracts `.value` (the id), and looks up via `skillMap.get(id)`. No primitive change needed; no compound-value hack required.

**Fix 3 — secondary description `text-xs`** (`SkillPicker.tsx:121`): added `text-xs` to `skill.comment` span.

**Lint:** `oxlint apps/admin/src/features/write/components/SkillPicker.tsx` — ok

**Typecheck:** `pnpm -C apps/admin exec tsc --noEmit --pretty false` — 0 errors

**Commit:** `658b71a fix(admin): correct Skill picker icon size, use id as combobox value`
