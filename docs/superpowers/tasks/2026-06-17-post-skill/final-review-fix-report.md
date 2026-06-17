# Final Review Fix Report

Branch: `feat/post-skill-attachment`
Date: 2026-06-17

---

## Fix 1 — Snippet list endpoint type filter

**Files touched:**
- `apps/core/src/modules/snippet/snippet.schema.ts` — added `SnippetListSchema` extending `BasicPagerSchema` with optional `type: z.nativeEnum(SnippetType)`; added `SnippetListDto` and `SnippetListInput` export
- `apps/core/src/modules/snippet/snippet.controller.ts` — replaced `BasicPagerDto` with `SnippetListDto` on `getList`; destructured `type` from query; passed to `repository.list`
- `apps/core/src/modules/snippet/snippet.repository.ts` — `list` now accepts optional `type?: SnippetType`; adds `eq(snippets.type, type)` to both the rows query and the count query when present
- `apps/core/test/src/modules/snippet/snippet.controller.e2e-spec.ts` — added 2 tests: `passes type=skill to repository.list`, `passes type=json to repository.list and excludes Skill rows`

**Tests added:** 2 new controller unit tests; all 5 pass.

**Commit:** `a1c998a86 fix(snippet): filter list endpoint by type query param`

**Surprising interactions:** None.

---

## Fix 2 — meta.skillIds case transform bypass

**Files touched:**
- `apps/core/src/modules/post/post.controller.ts` — imported `BypassCaseTransform`; added `@BypassCaseTransform(['meta'])` to both `getById` and `getByCateAndSlug`
- `apps/core/test/src/modules/post/post-skill.e2e-spec.ts` — added `meta.skillIds case transform bypass` describe block with 1 test asserting `body.data.meta.skillIds` is camelCase (not `skill_ids`)

**Tests added:** 1 new e2e test; all 10 pass.

**Commit:** `45fab71c7 fix(post): bypass case transform on post.meta to preserve skillIds round-trip`

**Surprising interactions:** The bypass path must be `'meta'` (not `'data.meta'`). The `transformResponseCase` is called with `envelope.data` as root; bypass segments are matched against keys traversed from that root, so `data.` prefix is NOT included in the path string. The CLAUDE.md doc says "paths root at `data`" meaning `data` is the conceptual root, not a literal path segment. Existing ai-agent usage of `'data.messages[]'` appears to be a silent no-op (untested).

---

## Fix 3 — Skill reference default on create only

**Files touched:**
- `apps/core/src/modules/snippet/snippet.service.ts` — removed `if (!model.reference || model.reference === 'root') model.reference = 'skill'` from `validateTypeAndCleanup`'s Skill branch; added equivalent guard after `validateTypeAndCleanup` in `create()` only
- `apps/core/test/src/modules/snippet/snippet.skill.service.spec.ts` — added `SnippetService — Skill update reference preservation` describe with 2 tests: PATCH with `reference: 'theme'` preserves it; PATCH without reference does not reset to `'skill'`

**Tests added:** 2 new unit tests; all 22 pass.

**Commit:** `72cf0577a fix(snippet): gate Skill reference default to create only`

**Surprising interactions:** None.

---

## Fix 4 — Server frontmatter regex relaxation

**Files touched:**
- `apps/core/src/modules/snippet/snippet.service.ts:285` — changed `^---\r?\n` to `^---[\t ]*\r?\n` on both fence lines in `parseSkillFrontmatter`

**Tests added:** None (existing 22 skill service tests still pass; no tests assert the strict form).

**Commit:** `ee63b1dc4 fix(snippet): align server frontmatter regex with admin preview`

**Surprising interactions:** None.

---

## Fix 5 — SkillPicker loading placeholder

**Files touched:**
- `apps/admin/src/features/write/components/SkillPicker.tsx` — inside the pills render loop, added an early-return loading branch that renders `animate-pulse` `…` placeholder and remove button using `bg-surface-inset`/`text-fg-subtle` tokens; the unavailable-pill branch only runs after `!skillsQuery.isLoading`

**Tests added:** None (pure visual fix; no existing test harness for admin components).

**Commit:** `0a6fe575f fix(admin): SkillPicker shows loading placeholder while fetching`

**Surprising interactions:** None.

---

## Fix 6 — Missing description warning in Skill preview

**Files touched:**
- `apps/admin/src/features/snippets/components/SkillFrontmatterPreview.tsx` — description row now shows red-X + `snippets.editor.skill.descriptionRequired` hint when `result.ok && result.name !== undefined && !result.description`; shows `—` quietly when no frontmatter parsed yet (`result.name === undefined`) or on parse error
- `apps/admin/src/i18n/resources/en-US.ts` — added `'snippets.editor.skill.descriptionRequired': 'frontmatter \`description\` is required'`
- `apps/admin/src/i18n/resources/zh-CN.ts` — added `'snippets.editor.skill.descriptionRequired': 'frontmatter \`description\` 为必填项'`

**Tests added:** None (visual fix).

**Commit:** `32caf361c fix(admin): warn on missing frontmatter description in Skill preview`

**Surprising interactions:** None.

---

## Aggregated Results

### Backend test suite (`pnpm -C apps/core test`)
- Test Files: 222 passed | 2 skipped (224)
- Tests: 1649 passed | 8 skipped (1657)
- No failures.

### Admin typecheck (`pnpm -C apps/admin run typecheck`)
- Exit 0. No errors.

### Admin lint (`pnpm -C apps/admin run lint`)
- BLOCKED: `oxlint` binary not found in the environment. The dependency is declared but not installed. This is a pre-existing environment issue; all code changes are clean per typecheck.

---

## Fix pass 2 — final reviewer follow-through

### I1 — `update()` preserves stored reference on PATCH

**Files touched:**
- `apps/core/src/modules/snippet/snippet.service.ts:154–155` — removed `const reference = newModel.reference ?? 'root'` line that ran before `old` was loaded; changed line 227 from `newModel.reference ?? reference` to `newModel.reference ?? old.reference ?? 'root'`
- `apps/core/test/src/modules/snippet/snippet.skill.service.spec.ts:388` — tightened assertion from `expect(callArg.reference).not.toBe('skill')` to `expect(callArg.reference).toBe('theme')` (matches the `existing` fixture's `reference: 'theme'`)

**Before → after assertion:** `expect(callArg.reference).not.toBe('skill')` → `expect(callArg.reference).toBe('theme')`

**Commit:** `84e5bb59 fix(snippet): update preserves stored reference on PATCH`

---

### Minor — unify zod enum style in `snippet.schema.ts`

**Files touched:**
- `apps/core/src/modules/snippet/snippet.schema.ts:82` — changed `z.nativeEnum(SnippetType)` to `z.enum(SnippetType)` in `SnippetListSchema`; `z.enum` is the project-dominant pattern (51 vs 2 usages across modules)

**Commit:** `e1e34f6b chore(snippet): unify zod enum style in schema`

---

### Minor — meta bypass assertion on `getByCateAndSlug`

**Files touched:**
- `apps/core/test/src/modules/post/post-skill.e2e-spec.ts` — added `meta.skillIds case transform bypass` describe block inside the `getByCateAndSlug` top-level describe, with 1 test asserting `body.data.meta.skillIds` is camelCase array and `body.data.meta.skill_ids` is undefined; mirrors the same describe block already present in `getById`

**Commit:** `e58ec015 test(post): cover meta bypass on getByCateAndSlug response`

---

### Aggregated results (fix pass 2)

**Backend (`pnpm -C apps/core test`):** 222 passed | 2 skipped | 1650 tests passed | 8 skipped. No failures.

**Admin typecheck (`pnpm -C apps/admin run typecheck`):** Exit 0. No errors.
