# Task 2 — `snippet-route` Skill response branch

## Scope (in)

- Modify `apps/core/src/modules/snippet/snippet-route.controller.ts`.
- In the `handleCustomPath` data-snippet path (between the `attachSnippet` call and the `reply.send(attached.data)` line at the end of the `if (dataSnippet)` branch), add a `dataSnippet.type === SnippetType.Skill` check that, before `reply.send`, sets:
  - `Content-Type: text/markdown; charset=utf-8`
  - `Cache-Control: public, max-age=300, stale-while-revalidate=3600`
- The redis-cached return path (when `cached` is set) must ALSO emit the same two headers for Skill — readers of a cached skill must not get `text/plain`. Wire this in the same branch logic.
- Add a faux e2e test file `apps/core/test/src/modules/snippet/snippet-route.skill.e2e-spec.ts` that:
  - Creates a Skill via `SnippetService` (or directly through the repository fixture) with frontmatter that satisfies Task 1's validator
  - Issues `GET /s/sk/<name>` via Fastify `inject`
  - Asserts:
    - Status 200
    - `content-type` header starts with `text/markdown` and includes `charset=utf-8`
    - `cache-control` header equals `public, max-age=300, stale-while-revalidate=3600`
    - Body equals the snippet's `raw` value byte-for-byte (no envelope wrapping — snippet-route uses `@HTTPDecorators.RawResponse`)
  - One additional case: `private = true` Skill returns 403 (or whatever `SNIPPET_PRIVATE` AppErrorCode maps to) for an unauthenticated request, AND returns 200 with the same headers when the request has admin access. Use the existing auth-mocking pattern from `apps/core/test/src/modules/snippet/snippet.controller.e2e-spec.ts` if there is one; otherwise mock at the guard level the way other e2e tests in this repo do.

## Scope (out)

- Do NOT change anything in `SnippetService` (Task 1 territory).
- Do NOT touch the function-snippet branch of `snippet-route.controller`.
- Do NOT add admin UI work, post integration, or Yohaku work.
- Do NOT change the redis cache key shape — reuse the existing `cacheSnippetByCustomPath` / `getCachedSnippetByCustomPath` calls.

## Exact values

- Content-Type literal: `text/markdown; charset=utf-8`
- Cache-Control literal: `public, max-age=300, stale-while-revalidate=3600`
- Route prefix (for URL construction in tests): `/s/sk/<name>` in tests (no `/api/v3/` prefix in test env — the e2e helper sets up dev-style routes; verify against an existing snippet e2e if uncertain).

## How to add the branch

Read the current `handleCustomPath` carefully — there are two `reply.send` calls in the data-snippet path:

```ts
if (cached) {
  const json = JSON.safeParse(cached)
  return reply.send(json || cached)
}

const attached = await this.snippetService.attachSnippet(dataSnippet)
await this.snippetService.cacheSnippetByCustomPath(
  path,
  !!attached.private,
  attached.data,
)
return reply.send(attached.data)
```

For Skill rows, both `reply.send` call sites must set the two headers first. Extract a small private helper `private applySkillResponseHeaders(reply: FastifyReply)` to avoid duplicating the header literals. Call it from BOTH places when `dataSnippet.type === SnippetType.Skill`.

The cache path stores `attached.data` (the raw markdown string). On read, `JSON.safeParse(cached)` will return `null` for raw markdown (it's not JSON), so the fallback `cached` string is what gets sent. That's already correct — you only need to add the headers.

## Conventions you MUST follow

- ZERO new comments, ZERO new JSDoc. Allowed only for UNEXPECTED behavior. Adding the small helper function does NOT need a docstring.
- Code is camelCase end-to-end.
- Error throws via `createAppException(AppErrorCode.<CODE>)` — for this task you should not be throwing any new errors; the existing `SNIPPET_PRIVATE` flow stays unchanged.
- Tests follow the existing `apps/core/test/src/modules/snippet/snippet.controller.e2e-spec.ts` and `apps/core/test/helper/create-e2e-app.ts` style. Use `createE2EApp` to spin up an in-process Nest app with the snippet module; use Fastify `inject` for requests.

## TDD evidence required

RED: write the e2e test first (header assertion will fail because the branch doesn't exist yet); capture the failing output.
GREEN: implement the branch; the test passes.

## Test commands

Focused test:
```bash
pnpm -C apps/core test -- test/src/modules/snippet/snippet-route.skill.e2e-spec.ts
```

Full suite before commit:
```bash
pnpm -C apps/core test
```

Lint scoped to changed files:
```bash
pnpm -C apps/core run lint -- apps/core/src/modules/snippet apps/core/test/src/modules/snippet
```

## Commit guidance

One commit on `feat/post-skill-attachment`:

```
feat(snippet-route): serve Skill snippets as text/markdown with cache headers

Skill-typed snippets fetched via /s/<customPath> now respond with
Content-Type: text/markdown; charset=utf-8 and a five-minute cache
window with SWR. Headers apply uniformly to fresh-attached and
redis-cached paths.
```

No AI co-authorship trailer.

## Pre-flight reminder

Task 1 added `SnippetType.Skill` already (commit `5ca37416`, fix at `65cad5d`). Confirm the import in the controller resolves before you start. The frontmatter contract is already enforced at write time, so any row reaching this controller with `type='skill'` is guaranteed to have valid frontmatter — you do NOT need to revalidate on read.
