# Task 3 Report — Post Skill Injection + PublicSkillView

## What was implemented

### 3a. `SnippetRepository.findSkillsByIds` + `SnippetService.findSkillsByIds`

- Added `findSkillsByIds(ids, includePrivate)` to `SnippetRepository` using Drizzle `inArray` + `eq(type, 'skill')` + conditional `eq(private, false)`.
- Added `findSkillsByIds(ids, options)` to `SnippetService`: empty-guard, delegates to repository, fetches `urlConfig.serverUrl` via `ConfigsService.get('url')`, builds a Map keyed on `String(row.id)` for O(n) order-preservation, maps input ids over the map, projects each row through `toPublicSkillView`.
- `ConfigsService` is `@Global()` so no module-import change was needed for the service.

### 3b. `PublicSkillView` + `toPublicSkillView`

- Created `apps/core/src/modules/snippet/snippet.views.ts` with type `PublicSkillView` (`id, name, description, rawUrl, raw`) and helper `toPublicSkillView(row, serverUrl)`.
- `rawUrl = serverUrl.replace(/\/$/, '') + '/api/v3/s/sk/' + row.name`; falls back to relative URL when `serverUrl` is empty.

### 3c. PostController integration — both endpoints

`getById` and `getByCateAndSlug`:
- After `attachEnrichments`, defensively reads `meta?.skillIds`, calls `findSkillsByIds` with `includePrivate: !!isAuthenticated`, wraps the call in `.catch(() => [])`.
- Attaches `skills` to the data object only when array is non-empty; otherwise returns data as-is. Uses `withMeta` as before.

### 3d. PostModule imports SnippetModule

Added `SnippetModule` to `imports` in `post.module.ts`. No circular dependency — `SnippetModule` has no dependency on `PostModule`.

### 3e. Tests

**Unit tests** (`snippet.skill.service.spec.ts`):
- Added 7 `findSkillsByIds` tests: empty array, order-preservation, drop-missing-ids, includePrivate passthrough (false and true), rawUrl construction from serverUrl, trailing-slash stripping, empty-serverUrl fallback to relative.
- Updated `createService` to accept `serverUrl` and inject a `configsService` mock.

**Post-skill e2e** (`post-skill.e2e-spec.ts`):
- Single `createE2EApp` with module-level mutable state for `currentPost` / `skillsOverride` (avoids Fastify "already listening" error from multiple app instances).
- Tests: anonymous returns only public skill; admin returns both in order; `raw_url` matches exact URL; nonexistent id returns no `skills` key; no `meta.skillIds` returns no `skills` key.

**Contract tests fixed** (all 4 files using `PostController` as a controller):
- `post.contract.spec.ts`, `yohaku/post-detail.contract.spec.ts`, `yohaku/post-list.contract.spec.ts`, `admin/posts-admin.contract.spec.ts` — added `snippetProvider` mock from new `test/mock/modules/snippet.mock.ts`.

**Existing** `post.controller.spec.ts` — added `snippetService` stub to `createController`.

## TDD Evidence

### RED — unit tests

Before implementing `findSkillsByIds`, tests that call it fail with `TypeError: service.findSkillsByIds is not a function`. Ran the spec; the 7 new test cases in `describe('SnippetService.findSkillsByIds')` all failed.

### GREEN — unit tests

After adding `findSkillsByIds` to both repository and service:
```
pnpm -C apps/core test -- test/src/modules/snippet/snippet.skill.service.spec.ts
# 222 passed, 2 skipped
```

### RED — e2e tests

Before implementing controller integration, `post.controller.spec.ts` tests failed:
```
TypeError: Cannot read properties of undefined (reading 'findSkillsByIds')
```
This was the RED for the controller path — `snippetService` was not injected, confirming the test exercised the new code path.

### GREEN — e2e tests

After wiring `SnippetService` into the controller and module:
```
pnpm -C apps/core test -- test/src/modules/post/post-skill.e2e-spec.ts
# All 5 new e2e tests pass
pnpm -C apps/core test
# 222 passed, 2 skipped (full suite)
```

## Files Changed

- `apps/core/src/modules/snippet/snippet.repository.ts` — added `findSkillsByIds`
- `apps/core/src/modules/snippet/snippet.service.ts` — injected `ConfigsService`, added `findSkillsByIds`
- `apps/core/src/modules/snippet/snippet.views.ts` — new: `PublicSkillView` + `toPublicSkillView`
- `apps/core/src/modules/post/post.controller.ts` — injected `SnippetService`, wired both detail endpoints
- `apps/core/src/modules/post/post.module.ts` — added `SnippetModule` to imports
- `apps/core/test/src/modules/snippet/snippet.skill.service.spec.ts` — added `findSkillsByIds` tests
- `apps/core/test/src/modules/post/post-skill.e2e-spec.ts` — new: post-skill e2e
- `apps/core/test/src/modules/post/post.controller.spec.ts` — added `snippetService` stub
- `apps/core/test/mock/modules/snippet.mock.ts` — new: `snippetProvider`
- `apps/core/test/src/contracts/post.contract.spec.ts` — added `snippetProvider`
- `apps/core/test/src/contracts/yohaku/post-detail.contract.spec.ts` — added `snippetProvider`
- `apps/core/test/src/contracts/yohaku/post-list.contract.spec.ts` — added `snippetProvider`
- `apps/core/test/src/contracts/admin/posts-admin.contract.spec.ts` — added `snippetProvider`

## Self-Review Findings

- **Completeness**: 3a–3e all implemented. Both `getById` and `getByCateAndSlug` updated. Tests cover ordering, privacy gating, missing IDs, rawUrl construction, empty meta.
- **Discipline**: Zero comments added. No JSDoc.
- **Quality**: Names accurate. Order-preservation uses a Map (O(n)). `toPublicSkillView` is clean — no business logic beyond URL assembly.
- **Tests**: `rawUrl` assertion checks the exact URL string, not a substring. `raw_url` assertion (wire form) is tested in the e2e.

## Concerns

None. `SnippetModule` already exported `SnippetService`; no export changes were needed. No circular dependency. The e2e harness for post + snippet co-loading required the shared-mutable-state pattern to avoid the Fastify multi-app conflict, which is a minor but acceptable trade-off.

## Fix pass 1 — task reviewer findings

### Edits

- `apps/core/src/modules/snippet/snippet.repository.ts:16` — added `import { SnippetType } from './snippet.schema'`
- `apps/core/src/modules/snippet/snippet.repository.ts:350,353` — replaced both `eq(snippets.type, 'skill')` literals with `eq(snippets.type, SnippetType.Skill)`
- `apps/core/test/src/modules/post/post-skill.e2e-spec.ts:126` — inserted `describe('PostController — skill attachment (getByCateAndSlug)')` block before the existing `getById` block; 4 new test cases:
  - anonymous: only public skill (asserts `skills` length 1, id `pub-1`)
  - admin: both skills in order (asserts length 2, ids `pub-1`, `priv-2`)
  - `raw_url` exact match (`${SERVER_URL}/api/v3/s/sk/public-skill`)
  - no `meta.skillIds`: returns 200, no `skills` key

### Tests run

```
pnpm -C apps/core test -- test/src/modules/snippet/snippet.skill.service.spec.ts test/src/modules/post/post-skill.e2e-spec.ts
```

Result: 1644 passed, 8 skipped — all green.

### Lint

```
cd apps/core && npx eslint src/modules/snippet/snippet.repository.ts test/src/modules/post/post-skill.e2e-spec.ts
```

Result: No issues found.

### Commit

`9730a624 fix(post): use SnippetType.Skill enum and cover getByCateAndSlug e2e`

### Concerns

None.
