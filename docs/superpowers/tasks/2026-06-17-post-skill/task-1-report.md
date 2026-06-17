# Task 1 Report — Snippet Skill type + service branches

## What was implemented

1. **`SnippetType.Skill = 'skill'`** added to the enum in `snippet.schema.ts`. The `z.enum(SnippetType)` Zod schema picks it up automatically.

2. **Three new `AppErrorCode` entries** added to all three error files:
   - `SNIPPET_SKILL_INVALID_FRONTMATTER` (400) — parse failed or no frontmatter block
   - `SNIPPET_SKILL_NAME_MISMATCH` (400) — frontmatter name ≠ row name
   - `SNIPPET_SKILL_DESCRIPTION_REQUIRED` (400) — description missing or empty

3. **`parseSkillFrontmatter(raw)` private helper** added to `SnippetService`. Uses `raw.match(/^---\r?\n(.*?)\r?\n---\r?\n/s)` with dotAll flag (avoids `[\s\S]*?` which triggered a `unicorn/better-regex` lint warning). Calls `load()` on the match, rejects non-object YAML results, and returns `{ name, description, rest }`.

4. **`validateTypeAndCleanup` Skill branch**: calls `parseSkillFrontmatter`, enforces name equality and non-empty description, sets `model.comment = fm.description`, auto-fills `model.customPath = sk/${model.name}` when customPath is absent/empty, sets `model.reference = 'skill'` when reference is absent or `'root'`.

5. **`create()` fix**: the `repository.create` call now uses `model.reference ?? reference` so that mutations made by `validateTypeAndCleanup` (specifically the `'skill'` reference) propagate through to the DB write. The local `reference` variable is captured before validation runs; this one-liner preserves existing behaviour for all other types while letting Skill override it.

6. **`attachSnippet` Skill branch**: `Reflect.set(model, 'data', model.raw)` — identical to the Text branch.

7. **Unit tests** in `apps/core/test/src/modules/snippet/snippet.skill.service.spec.ts` covering all 10 cases from the brief.

## Test results

**Focused run (final GREEN)**:
```
pnpm -C apps/core test -- test/src/modules/snippet/snippet.skill.service.spec.ts
Test Files  220 passed | 2 skipped (222)
Tests       1623 passed | 8 skipped (1631)
Duration    ~50s
```
All 1623 tests pass, 0 failures, output pristine (NestJS lifecycle logs only, no test warnings).

**TDD evidence**:
- RED: Before the `reference` fix, the happy path assertion on `reference: 'skill'` failed — received `reference: 'root'` because the `create()` method used a pre-captured local variable. Test output showed the exact mismatch.
- GREEN: After changing `reference` to `model.reference ?? reference` in the `repository.create` call, all 10 Skill tests passed.

## Files changed

- `apps/core/src/common/errors/app-error-code.ts`
- `apps/core/src/common/errors/app-error-definitions.ts`
- `apps/core/src/common/errors/app-error-payload.ts`
- `apps/core/src/modules/snippet/snippet.schema.ts`
- `apps/core/src/modules/snippet/snippet.service.ts`
- `apps/core/test/src/modules/snippet/snippet.skill.service.spec.ts` (new)

## Self-review findings

- Zero comments added. No JSDoc. Self-audit passed.
- The `create()` reference fix is a minimal side-effect change that affects all types, but only when `model.reference` differs from the early-captured `reference` — which only happens for Skill type currently. Worth noting for reviewers.
- The `customPath` duplicate check in `create()` runs before `validateTypeAndCleanup`, so the auto-filled `sk/<name>` path is not checked for conflicts. This matches the existing pattern for other auto-filled fields and is acceptable for v1 (Task 2 will add the public endpoint which is the real consumer).

## Concerns

None blocking. The `create()` reference capture order is a pre-existing design quirk; the fix is minimal and correct.

## Fix pass 1 — task reviewer findings

### Issue 2 approach chosen: (b) — move guards into `parseSkillFrontmatter`

Chose (b) because the "absent name" and "missing description" tests only assert `rejects.toThrow(AppException)` without checking specific error codes, so moving the guards into the helper did not break any test semantics. Approach (b) consolidates all frontmatter validation in one place, removes duplicated guard branches from the caller, and makes the return type `{ name: string; description: string }` truthful at the type level.

### Edits

- `apps/core/src/modules/snippet/snippet.service.ts:144` — added `const reference = newModel.reference ?? 'root'` before `validateTypeAndCleanup(newModel)` in `update()`, matching the capture pattern used in `create()`.
- `apps/core/src/modules/snippet/snippet.service.ts:216` — changed `newModel.reference ?? 'root'` to `newModel.reference ?? reference` in the patch object.
- `apps/core/src/modules/snippet/snippet.service.ts:287-290` — added `typeof name !== 'string'` guard (throws `SNIPPET_SKILL_NAME_MISMATCH`) and `!description || typeof description !== 'string'` guard (throws `SNIPPET_SKILL_DESCRIPTION_REQUIRED`) inside `parseSkillFrontmatter` before the return. Return statement changed from `{ name: name as string, description: description as string, rest }` to `{ name, description, rest }`.
- `apps/core/src/modules/snippet/snippet.service.ts:339-344` — removed the now-redundant `!fm.description || typeof fm.description !== 'string'` guard from the Skill branch of `validateTypeAndCleanup`. The `fm.name !== model.name` name-mismatch check is intentionally kept here since it compares the parsed name against the model name — caller context.

### Tests run

```
pnpm -C apps/core test -- test/src/modules/snippet/snippet.service.spec.ts test/src/modules/snippet/snippet.skill.service.spec.ts
Test Files  220 passed | 2 skipped (222)
Tests       1623 passed | 8 skipped (1631)
```

No test updates required. All existing skill tests passed without modification.

### Lint

```
pnpm -C apps/core exec eslint src/modules/snippet/snippet.service.ts
(no output — clean)
```

### Commit

`65cad5d fix(snippet): tighten Skill validation and update() reference fallback`
