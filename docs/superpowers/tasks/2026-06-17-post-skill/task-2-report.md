# Task 2 Report — snippet-route Skill response branch

## What was implemented

Added a `private applySkillResponseHeaders(reply: FastifyReply)` helper to `SnippetRouteController` that sets:
- `Content-Type: text/markdown; charset=utf-8`
- `Cache-Control: public, max-age=300, stale-while-revalidate=3600`

Called from both `reply.send` paths in the `if (dataSnippet)` branch:
1. The redis-cached path (before `reply.send(json || cached)`)
2. The fresh-attach path (before `reply.send(attached.data)`)

Both calls are gated on `dataSnippet.type === SnippetType.Skill`, so non-Skill snippets are unaffected.

## TDD Evidence

### RED — failing test run

Command:
```
pnpm -C apps/core test -- test/src/modules/snippet/snippet-route.skill.e2e-spec.ts
```

Failures (3 tests):
```
FAIL  returns text/markdown with cache headers for a public Skill snippet
AssertionError: expected 'text/plain; charset=utf-8' to match /^text\/markdown/

FAIL  returns 200 with Skill headers for admin access to a private Skill snippet
AssertionError: expected 'text/plain; charset=utf-8' to match /^text\/markdown/

FAIL  returns Skill headers from the redis-cached path
AssertionError: expected 'text/plain; charset=utf-8' to match /^text\/markdown/
```

The 403 test passed (existing private-guard logic already worked).

### GREEN — passing test run after implementation

```
Test Files  221 passed | 2 skipped (223)
Tests  1627 passed | 8 skipped (1635)
```

All 4 new tests pass. Full suite clean.

## Files changed

- `apps/core/src/modules/snippet/snippet-route.controller.ts` — import `SnippetType`, add `applySkillResponseHeaders`, call it in both send paths
- `apps/core/test/src/modules/snippet/snippet-route.skill.e2e-spec.ts` — new e2e test file (4 cases)

## Self-review

- Both `reply.send` paths covered: yes
- Headers set on cached path: yes
- No new comments or JSDoc: verified (zero)
- Body byte-for-byte assertion: yes (`expect(res.body).toBe(SKILL_RAW)`)
- Private + admin-access case covered: yes
- Lint: clean

## Concerns

None. Diff is minimal and confined to the controller and test file.

## Fix pass 1 — task reviewer findings

**Approach chosen:** (a) — switch on both `path` AND `type` in the mock.

Approach (a) was chosen over (b) because it is forward-compatible: a future author adding a private-cached test scenario can rely on the mock returning `null` for `'public'` lookups on that path without touching the mock itself. Approach (b) (asserting `type === 'public'` and returning `null` otherwise) would achieve the same correctness for the current test but would make it harder to add private-cache cases later.

**Edit location:** `apps/core/test/src/modules/snippet/snippet-route.skill.e2e-spec.ts:62-67`

Changed `async (path: string)` to `async (path: string, type: 'public' | 'private')` and added `&& type === 'public'` to the condition for returning `SKILL_RAW`.

**Tests run:**
```
pnpm -C apps/core test -- test/src/modules/snippet/snippet-route.skill.e2e-spec.ts
```
Result: Test Files 221 passed | 2 skipped (223), Tests 1627 passed | 8 skipped (1635). All 4 Skill suite cases pass.

**Lint:** `npx eslint test/src/modules/snippet/snippet-route.skill.e2e-spec.ts` — no issues found.
