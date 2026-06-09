# mxs project management — design

**Date:** 2026-06-09
**Status:** Approved
**Owner:** Innei

## Goal

Add a full `mxs project <verb>` subcommand surface to `@mx-space/cli` for managing the `projects` resource end-to-end, mirroring the existing `mxs post` style. Tighten the server-side `ProjectController` with a Zod DTO at the same time, and expose a typed `projects` controller from `@mx-space/api-client`.

## Non-goals

- Publish/draft state — `projects` has no such concept.
- Categories / tags / topics / Lexical content — `text` is a plain string.
- Server data migration — schema is unchanged.
- A dedicated `GET /projects/by-name/:name` endpoint — resolver fans out to `/projects/all` and matches locally; project counts on a personal blog are small (typically <100).

## Current state (anchor)

- Server: `apps/core/src/modules/project/{controller,repository,types,module}.ts` — REST CRUD already exists at `/projects`, but `create`/`update` accept `body: any` (no validation). `update` uses HTTP `PUT`.
- Schema: `packages/db-schema/src/schema/ops.ts` — `projects` table. Columns: `id`, `createdAt`, `name (unique, not null)`, `description (not null)`, `previewUrl`, `docUrl`, `projectUrl`, `images (text[])`, `avatar`, `text`.
- api-client: no `projects` surface yet.
- CLI: no `project` verb group yet. Closest analog is `src/cli/post/*`.

## User-facing surface

### Verbs

```
mxs project list   [--page N] [--size N]
mxs project get    <nameOrId>
mxs project view   <nameOrId>
mxs project create --name X --description Y
                   [--preview-url U] [--doc-url U] [--project-url U]
                   [--avatar U] [--images "u1,u2"] [--text "..."]
                   [--file path.json] [--open] [--silent]
mxs project edit   <nameOrId> [--silent] [--open]
mxs project update <nameOrId> [same flags as create, none required]
mxs project delete <nameOrId> [--force]
```

### Identifier resolution

`<nameOrId>` is resolved by `Resolver.resolveProjectId`:

1. If the value matches the Snowflake regex (`/^\d{15,}$/`), pass it through unchanged.
2. Otherwise, `GET /projects/all`, then `matchItem` on `name` (exact, then case-insensitive). On miss, throw `ResourceNotFound`.

Project has no `slug`, so only `name` participates in matching.

### Edit envelope (JSON)

`mxs project edit <nameOrId>` opens `$EDITOR` with a pretty-printed JSON object containing the editable fields:

```jsonc
{
  "name": "kami",
  "description": "personal blog stack",
  "previewUrl": "https://...",
  "docUrl": null,
  "projectUrl": "https://github.com/...",
  "avatar": "https://...",
  "images": ["https://a", "https://b"],
  "text": "free-form notes"
}
```

- `id` and `createdAt` are intentionally excluded (read-only).
- Round-trip: if the saved buffer is byte-identical to the initial buffer, emit `no changes` and return without an API call.
- Parse failure surfaces as a new `ValidationJson` tagged error.
- A successful parse sends `PATCH /projects/:id` with the parsed object as the body. Server PATCH treats missing keys as no-op, so clearing a field requires setting it to `null` explicitly.

### Flag conventions

- `--images` accepts a comma-separated string and is parsed via the existing `parseCsv` helper, mirroring `--tags` on post.
- `--file <path>` reads a JSON file and merges it into the payload, mirroring post's file path.
- `--open` opens the admin edit page after success.
- `--silent` collapses the success response to `{ ok: true }`.
- `delete --force` skips the TTY guard, matching `mxs post delete --force`.

### Output

- `list` renders through a new `projectListView` (modes: `readable`, `llm`). No `xml` mode — the edit envelope is JSON. Server-side ordering is fixed (`createdAt DESC`); a sort flag is deferred until a user asks.
- `view` renders through `projectView` (modes: `readable`, `llm`).
- `get` returns the raw API envelope unchanged.
- `create`/`edit`/`update` emit success via `emitSuccess`.

## Server changes

### Zod DTO

New file `apps/core/src/modules/project/project.dto.ts`:

```ts
import { z } from 'zod'

export const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  previewUrl: z.url().nullish(),
  docUrl: z.url().nullish(),
  projectUrl: z.url().nullish(),
  avatar: z.url().nullish(),
  images: z.array(z.url()).max(20).nullish(),
  text: z.string().max(50_000).nullish(),
})

export const ProjectPatchSchema = ProjectCreateSchema.partial()

export type ProjectCreateDto = z.infer<typeof ProjectCreateSchema>
export type ProjectPatchDto = z.infer<typeof ProjectPatchSchema>
```

Limits: `name` 80, `description` 500, `text` 50_000, `images` ≤ 20 entries. URLs must parse via `z.url()`. All non-required keys accept `null` so the JSON edit envelope can clear a value explicitly.

### Controller wiring

- `POST /projects` — body validated through `ProjectCreateSchema`. Returns the created row.
- `PATCH /projects/:id` — new route. Body validated through `ProjectPatchSchema`. Delegates to the same repository `update` method (which already treats missing keys as no-op).
- `PUT /projects/:id` — kept for backward compatibility with the admin SPA (`apps/admin/src/api/projects.ts` calls `putJson`). Body validated through `ProjectPatchSchema` (same shape — full replace is not used in practice). Delegates to the same handler as PATCH. A follow-up commit (out of scope for this design) can migrate admin to PATCH and drop the PUT route.
- `GET /projects`, `GET /projects/all`, `GET /projects/:id`, `DELETE /projects/:id` are unchanged.
- Response shape: keep wrapping via `withMeta` for the paged list, return repository rows directly elsewhere (the global `ResponseInterceptor` adds the envelope and snake_cases at the wire boundary).

### Views

New `apps/core/src/modules/project/project.views.ts` defines `ProjectViews.detail` and `ProjectViews.card` for response filtering. Apply in the controller before returning.

### Tests

`apps/core/test/src/modules/project/project.controller.spec.ts`:

- Rejects missing `name`/`description` with `VALIDATION_FAILED` (400).
- Rejects malformed URLs in `previewUrl`/`docUrl`/`projectUrl`/`avatar`.
- Rejects more than 20 entries in `images`.
- Accepts `null` for every optional field.
- `PATCH` with `{ name: "new" }` leaves other columns intact.
- `DELETE` returns the deleted row.

## api-client changes

New `packages/api-client/src/controllers/project.controller.ts` exposing:

```ts
class ProjectController {
  getAll(): Promise<Project[]>
  getList(page?: number, size?: number): Promise<PaginateResult<Project>>
  getById(id: string): Promise<Project>
  create(input: ProjectCreateDto): Promise<Project>
  update(id: string, patch: ProjectPatchDto): Promise<Project>
  delete(id: string): Promise<void>
}
```

Wire it through the existing controller registry the same way `category` / `topic` are wired. Add the `Project` model type to `models/project.ts`. The CLI does NOT consume api-client for HTTP — it goes through its own `Api` service — but downstream consumers (admin SPA) gain a typed surface.

Tests under `packages/api-client/__tests__/` mirror the existing `category` tests.

## CLI implementation outline

### File layout

```
packages/cli/src/cli/project/
  index.ts        # aggregator (Command.withSubcommands)
  _flags.ts       # shared write options + CSV/URL/file parsing
  list.ts
  get.ts
  view.ts
  create.ts
  edit.ts
  update.ts
  delete.ts
```

### Resolver

Extend `packages/cli/src/services/Resolver.ts`:

- Add `resolveProjectId(nameOrId)` to the `ResolverService` interface.
- Implement: Snowflake short-circuit → `/projects/all` fetch (cached via the existing resolver cache pattern) → `matchItem` on `name` only → fail with `ResourceNotFound` carrying a Levenshtein hint.
- Add `'project'` to `ResolverKind` so `invalidate` can target it.

### Errors

`packages/cli/src/domain/errors.ts`: add `ValidationJson` as a `Data.TaggedError` class. Map to the same exit code as `ValidationXml` in `exitCodeForTag`. Add a fixture in the integration error-envelope test.

### Help

`packages/cli/src/cli/help/`: register the project group in the help-data builders. Title `project`, one-line description `manage portfolio projects`.

### Renderer view

`packages/cli/src/cli/project/view.ts` follows the post view pattern:

- `projectView` (modes: `readable`, `llm`) — fields: `id`, `name`, `description`, `previewUrl`, `docUrl`, `projectUrl`, `avatar`, `images` (count + first 3), `createdAt`. `text` rendered as a separate body block when present.
- `projectListView` (modes: `readable`, `llm`) — count + page/size/total header, then per-item `id`, `name`, `description`, `createdAt`.

### README

`packages/cli/README.md` gains a `Project` section under the resource list, matching the post/note/page layout. Includes one example per verb.

### Roadmap

`packages/cli/ROADMAP.md`: move the surface out of "Next" and add a "Shipped" entry under the next version line.

## Tests (CLI)

Unit (`packages/cli/test/cli/project/`):

- `list.test.ts` — happy path, pagination params.
- `get.test.ts` — by id, by name (via resolver), not-found.
- `view.test.ts` — readable and llm modes, with and without `text`.
- `create.test.ts` — flag-driven payload, `--file`, missing required field surfaces a server validation error envelope.
- `edit.test.ts` — round-trip no-change, round-trip with edit, malformed JSON → `ValidationJson`.
- `update.test.ts` — flag-driven PATCH; absent flags do not appear in the body.
- `delete.test.ts` — `--force` skips the TTY guard; non-TTY without `--force` fails fast.

Integration (`packages/cli/test/integration/project.test.ts`):

- One smoke per verb spawning the real binary against a canned HTTP layer, asserting stdout, stderr, and exit code.

## Open risks and trade-offs

- **`/projects/all` fetch latency** — on installs with many projects this could grow. Resolver caches per process, so cost is one round-trip per `mxs` invocation. Add the cache invalidation hook (`Resolver.invalidate('project')`) after `create`/`update`/`delete` to keep follow-up `view` calls fresh in the same process.
- **Admin SPA still on PUT** — `apps/admin/src/api/projects.ts` calls `putJson`. We keep `PUT /projects/:id` as an alias to the PATCH handler so this change is not wire-breaking. Migration of admin to PATCH is a separate follow-up.
- **No editor-aware schema hints** — `ValidationJson` reports parser errors but not field-level Zod errors. The server's `VALIDATION_FAILED` envelope already returns `details.issues`; the CLI surfaces that on the failure path, so the user sees the diff after saving.
- **Duplicate `name` surfaces as Postgres unique-violation** — the `projects_name_uniq` index already exists. The repository catches Postgres error `23505` (mirroring the pattern in `auth.service.ts` and `poll.service.ts`) and rethrows via `createAppException(AppErrorCode.PROJECT_NAME_TAKEN, { name })` — a new enum value added to `app-error-code.ts` and mapped to HTTP 409 in the error-code → status table. The controller test pins this path.

## Files changed (summary)

```
apps/core/src/modules/project/project.controller.ts        modified
apps/core/src/modules/project/project.dto.ts               new
apps/core/src/modules/project/project.views.ts             new
apps/core/src/modules/project/project.module.ts            modified (DTO wiring)
apps/core/test/src/modules/project/project.controller.spec.ts  new

packages/api-client/src/controllers/project.controller.ts  new
packages/api-client/src/models/project.ts                  new
packages/api-client/src/index.ts                           modified (export)
packages/api-client/__tests__/project.controller.spec.ts   new

packages/cli/src/bin/mxs.ts                                modified (register group)
packages/cli/src/cli/help/*                                modified (group metadata)
packages/cli/src/cli/project/{index,_flags,list,get,view,create,edit,update,delete}.ts  new
packages/cli/src/services/Resolver.ts                      modified (resolveProjectId)
packages/cli/src/domain/errors.ts                          modified (ValidationJson)
packages/cli/test/cli/project/*.test.ts                    new
packages/cli/test/integration/project.test.ts              new
packages/cli/README.md                                     modified
packages/cli/ROADMAP.md                                    modified
```
