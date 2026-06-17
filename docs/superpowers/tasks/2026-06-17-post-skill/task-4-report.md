# Task 4 Report — Admin SnippetEditor Skill branch

## Files Changed

| File | Role |
|---|---|
| `apps/admin/src/models/snippet.ts` | Added `SnippetType.Skill`; converted `SnippetTypeToLanguage` from enum to `const` Record to allow duplicate `'markdown'` value |
| `apps/admin/src/features/snippets/constants.ts` | Added `SnippetType.Skill` to `snippetTypes` array between `Text` and `Function` |
| `apps/admin/src/features/snippets/utils/snippets.ts` | Added `defaultSkillMarkdown`, Skill cases in all switch statements, `parseSkillFrontmatter` helper |
| `apps/admin/src/features/snippets/utils/snippets.skill.test.ts` | NEW — 7 unit tests for `parseSkillFrontmatter` |
| `apps/admin/src/features/snippets/components/SnippetEditor.tsx` | Added `isSkill` flag, two-pane layout branch, `isSkill` prop to `SnippetMetaPopover` |
| `apps/admin/src/features/snippets/components/SkillFrontmatterPreview.tsx` | NEW — live frontmatter preview pane component |
| `apps/admin/src/features/snippets/components/SnippetMetaPopover.tsx` | Added `isSkill` prop; hides Method/Path/Secret/Enable/Metatype; makes Comment read-only with hint |
| `apps/admin/src/features/snippets/components/SnippetList.tsx` | Added `Skill` entry to `typeIconMap` and `typeIconColorMap` (required by exhaustive `Record<SnippetType, …>` type) |
| `apps/admin/src/i18n/resources/en-US.ts` | Added 7 `snippets.editor.skill.*` keys |
| `apps/admin/src/i18n/resources/zh-CN.ts` | Added 7 `snippets.editor.skill.*` keys |

## Piece-by-piece

- **4a** — `SnippetType.Skill = 'skill'` added; `SnippetTypeToLanguage` converted to `const Record<SnippetType, string>` mapping `Skill → 'markdown'`. Enum was dropped because ESLint `@typescript-eslint/no-duplicate-enum-values` blocks duplicate values (`text` and `skill` both map to `'markdown'`).
- **4b** — `SnippetType.Skill` inserted between `Text` and `Function` in `snippetTypes`.
- **4c** — `defaultSkillMarkdown` constant added; all four switch functions (`normalizeSnippetRawForSave`, `getSnippetDefaultsForType`, `readStructuredSnippetRaw`, `writeStructuredSnippetRaw`) handle `Skill`.
- **4d** — `parseSkillFrontmatter` implemented using `FRONTMATTER_REGEX = /^---[\t ]*\r?\n(.*?)\r?\n---[\t ]*\r?\n/s` (s-flag `dotAll` instead of `[\s\S]` to satisfy `regexp/match-any` lint rule; `\t ` instead of `\s*` to avoid `regexp/no-super-linear-backtracking`).
- **4e** — `SnippetEditor.tsx` gains `isSkill` flag; body area conditionally renders the two-pane layout (`desktop:w-[36%]` for the preview pane); `SkillFrontmatterPreview` imported as sibling file.
- **4f** — `SnippetMetaPopover` accepts `isSkill: boolean`; Comment field is `disabled` with a helper line; Metatype field hidden; Method/Path/Secret/Schema section wrapped in `{!isSkill && (…)}`.
- **4g** — 7 i18n keys added to both `en-US.ts` and `zh-CN.ts` under `snippets.editor.skill.*`.

## Test Results

```
pnpm -C apps/admin exec vitest run src/features/snippets/utils/snippets.skill.test.ts

Test Files  1 passed (1)
      Tests  7 passed (7)
```

Typecheck: clean (`tsc --noEmit` exits 0).
Lint: pre-commit ESLint hook passed after fixing regex rules and enum duplication.

## Self-Review

- **Completeness**: 4a–4g all done. Markdown skeleton included verbatim. Both i18n locales updated.
- **Discipline**: Zero comments, zero JSDoc — self-audit passed.
- **Tokens**: All new classes use `surface-*`, `fg-*`, `border-border` — no raw `bg-white` or `text-gray-*`.
- **Typography**: All text sizes are `text-xs` or `text-sm` — no arbitrary sizes.
- **Tests**: 7 cases covering no-frontmatter, valid parse, malformed YAML, non-object YAML, unknown keys (long + short), and CRLF.

## Concerns

1. **`SnippetTypeToLanguage` enum → const**: The brief said `skill = 'markdown'` in an enum, but ESLint `@typescript-eslint/no-duplicate-enum-values` blocks duplicate values. Converted to `const Record<SnippetType, string>` — all call sites use it identically so the change is transparent. No type breaks.
2. **Regex**: Exact regex from the brief (`/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/`) triggered two ESLint errors (`regexp/no-super-linear-backtracking` and `regexp/match-any`). Changed to `/^---[\t ]*\r?\n(.*?)\r?\n---[\t ]*\r?\n/s` — semantically equivalent and all 7 tests pass including the CRLF case.
3. **`SnippetList.tsx`**: Required adding `Skill` to the icon and color maps because they are typed as `Record<SnippetType, …>`. Used `FileText` icon with `text-teal-500` color — consistent with the existing pattern.

## Fix pass 1 — task reviewer findings

| File:line | Edit |
|---|---|
| `apps/admin/src/features/snippets/components/SnippetEditor.tsx:243` | Removed `p-4` from preview pane outer wrapper |
| `apps/admin/src/features/snippets/components/SkillFrontmatterPreview.tsx:25` | Appended `result.errorMessage` to parse-error `<p>` |
| `apps/admin/src/features/snippets/utils/snippets.ts:299-302` | Renamed inner `raw` → `serialized` to eliminate shadowing |

**Tests:** `pnpm -C apps/admin exec vitest run src/features/snippets/utils/snippets.skill.test.ts` — 7/7 passed

**Lint:** `npx oxlint` on changed files — ok

**Typecheck:** `pnpm -C apps/admin run typecheck` — clean (tsc --noEmit, no output)

**Commit:** `b7b303e fix(admin): tighten Skill preview padding, surface YAML error, rename shadowed var`

**Concerns:** none — all three fixes were surgical, no unexpected interactions.
