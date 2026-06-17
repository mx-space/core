# Task 3 — PostService Skill injection + `PublicSkillView`

## Scope (in)

Three pieces, all in the same task:

### 3a. `SnippetService.findSkillsByIds`

Add to `apps/core/src/modules/snippet/snippet.service.ts`:

```ts
async findSkillsByIds(
  ids: string[],
  options: { includePrivate?: boolean } = {},
): Promise<PublicSkillView[]>
```

Behavior:
- Empty `ids` → return `[]`.
- Fetch snippets where `type = 'skill'` AND `id IN (ids)`. If `options.includePrivate !== true`, also restrict `private = false`.
- Drop any IDs that didn't resolve to a row.
- Preserve INPUT order — sort the result array to match the order of the IDs the caller passed (use a Map keyed on `id` to look up rows, then map `ids` over the map).
- Project each row through `PublicSkillView` (see below) and return the array.

### 3b. `PublicSkillView` type + projection helper

Add a small Zod-or-plain type definition for the view. Project from a `SnippetRow` to:

```ts
type PublicSkillView = {
  id: string             // snowflake serialized as string
  name: string
  description: string    // from row.comment (Task 1 wrote it from frontmatter)
  rawUrl: string         // absolute URL — see "URL construction"
  raw: string            // row.raw — full markdown including frontmatter
}
```

Where to put the type: prefer `apps/core/src/modules/snippet/snippet.views.ts` if a `*.views.ts` file exists for the snippet module; otherwise create it. Snippet views file currently does not exist — check; if absent, you may either (a) create `snippet.views.ts` or (b) co-locate as an exported type in `snippet.service.ts`. The repository convention (per `CLAUDE.md`) is `*.views.ts`. Prefer (a).

#### URL construction

Build `rawUrl` as `${serverUrl}/api/v3/s/sk/${name}` where `serverUrl` comes from the existing `ConfigsService.get('urlConfig').serverUrl` (see `apps/core/src/modules/configs/configs.default.ts:14` — default `http://localhost:2333`). Strip any trailing `/` from `serverUrl` before concatenation.

Hard-code the `/api/v3/s/sk/` prefix — version is currently 3 (verified in spec). Do NOT add a new config knob for `skillPublicPrefix` in this task — that's a deferred extension.

If `serverUrl` is somehow absent or invalid, fall back to a relative URL `'/api/v3/s/sk/' + name` and log nothing (the caller's site is misconfigured, not the skill's fault).

### 3c. `PostController` integration — TWO endpoints

In `apps/core/src/modules/post/post.controller.ts`:

- `@Get('/:id')` (`getById`, current line ≈ 213): after `attachEnrichments` returns `docData`, call `snippetService.findSkillsByIds(meta.skillIds ?? [], { includePrivate: !!isAuthenticated })`. Attach the result as `docData.skills` ONLY when the array is non-empty. Return the merged object via `withMeta`.

- `@Get('/:category/:slug')` (`getByCateAndSlug`, current line ≈ 280): same pattern — after `attachEnrichments`, fetch skills, attach as `postData.skills` when non-empty.

`meta.skillIds` is read from the post document's existing `meta` jsonb column. Coerce defensively: only proceed if `Array.isArray(post.meta?.skillIds) && post.meta.skillIds.length > 0`. Otherwise pass `[]`.

The `isAuthenticated` flag drives `includePrivate`. Match the same pattern the controller already uses for `isPublished` gating.

### 3d. `PostModule` imports `SnippetModule`

In `apps/core/src/modules/post/post.module.ts`, add `SnippetModule` to `imports`. Verify `SnippetModule` exports `SnippetService` (it currently does for `snippet-route` to consume — confirm by reading the module file).

If there is a circular-dependency risk (snippet importing post for any reason), use `forwardRef`. Don't pre-emptively wrap — only if a real cycle appears.

### 3e. Tests

Add a faux e2e test file `apps/core/test/src/modules/post/post-skill.e2e-spec.ts` that:
- Creates two `Skill` snippets (one public, one private)
- Creates a post with `meta.skillIds = [publicId, privateId]`
- Fetches `GET /api/v3/posts/:id` (or whatever the e2e helper exposes — match `snippet-route.skill.e2e-spec.ts`'s URL convention):
  - Anonymous request: `data.skills` contains ONLY the public skill; ordering preserved
  - Admin request: `data.skills` contains both, in `[publicId, privateId]` order
- One additional case: a post with `meta.skillIds = ['nonexistent-id']` returns successfully with NO `skills` field on `data` (or `skills: []` — choose ONE convention and assert it consistently)
- One additional case: a post with no `meta.skillIds` at all returns successfully with NO `skills` field on `data`
- One additional case: a skill's `rawUrl` matches `${serverUrl}/api/v3/s/sk/<name>`

Add a `SnippetService` unit test for `findSkillsByIds`:
- Empty array returns empty
- Order preserved against `ids` (test with a 3-id query against rows inserted in reverse order)
- Non-skill rows are NOT returned (insert a `type='text'` row, query for its ID — should be dropped)

## Scope (out)

- No `/skills` index page or list endpoint.
- No skill versioning, hashing, or signature.
- No admin UI changes (Tasks 4–5).
- No Yohaku changes.
- No `BypassCaseTransform` decorators in this task — `rawUrl` will emit as `raw_url` on the wire, which matches the spec.
- Do NOT introduce a `skillPublicPrefix` config option in this task.

## Exact values & relationships

- View field order in projection (for consistency): `id`, `name`, `description`, `rawUrl`, `raw`.
- Order between `attachEnrichments` and `findSkillsByIds` calls: enrichments first, then skills. The latter is allowed to fail without rolling back enrichments — wrap the skills call in `try/catch` that logs and returns `[]` so a broken snippet row doesn't 500 the post.
- Decision: when the skills array would be empty, OMIT the `skills` key from `data` (not present is better than `skills: []` because the wire is JSON and consumers can `data.skills?.length`).

## Conventions you MUST follow

- API response envelope rules in `CLAUDE.md` root: don't double-wrap, don't return `{ data, ... }`. Use `withMeta`.
- ZERO comments, ZERO JSDoc by default. Only for UNEXPECTED behavior.
- camelCase end-to-end; the response interceptor handles snake_case conversion.
- Error throws via `createAppException(AppErrorCode.<CODE>)` — but this task should not need new error codes. If you find yourself adding one, escalate first.

## TDD evidence required

RED for the SnippetService unit tests is straightforward — write the test, watch it fail because `findSkillsByIds` doesn't exist yet.

RED for the post e2e is murkier (the controller path needs the method present even to compile). Acceptable RED for the e2e is: stub `findSkillsByIds` to return `[]`, write the e2e expecting actual skills, watch it fail with empty `skills`. Then implement the method properly.

Capture both REDs.

## Test commands

```bash
pnpm -C apps/core test -- test/src/modules/post/post-skill.e2e-spec.ts
pnpm -C apps/core test -- test/src/modules/snippet/snippet.skill.service.spec.ts
pnpm -C apps/core test   # full suite once before commit
```

Lint scope:
```bash
pnpm -C apps/core run lint -- apps/core/src/modules/snippet apps/core/src/modules/post apps/core/test/src/modules/post apps/core/test/src/modules/snippet
```

## Commit guidance

ONE commit (or two if your TDD flow naturally splits; prefer one). Conventional Commit subject:

```
feat(post): attach AI skills to post detail responses

PostController now reads meta.skillIds from the post document and
attaches a public-projection skills array via SnippetService. Private
skills appear only to authenticated callers; missing or non-skill IDs
are silently dropped. PublicSkillView includes a precomputed rawUrl
pointing at the snippet-route public path.
```

No AI co-authorship trailer.

## Pre-flight notes

- Tasks 1 and 2 are already merged on `feat/post-skill-attachment` (commits `5ca37416`, `65cad5d`, `aa712cc8`, `b3671d2`).
- `SnippetType.Skill = 'skill'` is the enum value. Use it via `SnippetType.Skill` — never the literal string in production code.
- The snippet `comment` field already holds the frontmatter description for Skill rows (set by Task 1's validator).
- `SnippetModule` lives at `apps/core/src/modules/snippet/snippet.module.ts`. Confirm it exports `SnippetService`.

## When you're in over your head

STOP and escalate (BLOCKED or NEEDS_CONTEXT) when:
- A circular dependency between Post and Snippet modules requires non-trivial refactoring
- The e2e test harness for post + snippet co-loading needs novel scaffolding
- The PostController flow you're modifying turns out to be more tangled than the brief suggests
