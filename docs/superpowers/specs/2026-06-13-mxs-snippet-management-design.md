# mxs CLI — Snippet Management Design

Date: 2026-06-13
Status: Approved

## Goal

Add a `snippet` command group to `@mx-space/cli` (`mxs`) covering full snippet
management against the mx-core `/snippets` API: list, get, create, update,
edit (via `$EDITOR`), and delete.

## Context

- CLI package: `packages/cli`, built on `@effect/cli` + Effect services
  (`Api`, `Renderer`, `Editor`). Command groups live in `src/cli/<group>/`
  with one file per verb plus an `index.ts` that registers help metadata and
  subcommands. The `topic` group is the structural template; `note edit` is
  the `$EDITOR` flow template (snippet edit is simpler — raw text, no
  Lexical).
- Server API (`apps/core/src/modules/snippet/snippet.controller.ts`), all
  admin-authed:
  - `GET /snippets?page&size` — paginated lean list (no `raw`)
  - `GET /snippets/group?page&size` — list grouped by reference
  - `GET /snippets/group/:reference` — lean snippets under one reference
  - `GET /snippets/:id` — full snippet including `raw`
  - `POST /snippets` — create, full `SnippetDto`
  - `PUT /snippets/:id` — update, **full** `SnippetDto` (not partial)
  - `DELETE /snippets/:id`
- Snippet fields (`snippet.schema.ts`): `name` (`/^[\w.-]{1,30}$/`),
  `reference` (default `root`), `type` (`json|json5|function|text|yaml`),
  `raw`, `private`, `comment`, `metatype`, `schema`, `method`, `customPath`,
  `secret`, `enable`.

## Decisions

### Addressing

`get` / `update` / `edit` / `delete` accept either:

- a Snowflake `<id>` (detected via `isSnowflakeId` from `services/Resolver`), or
- `<reference>/<name>` — resolved by fetching
  `GET /snippets/group/:reference` and matching `name` exactly. No match →
  `ResourceNotFound` (kind `snippet`).

A bare token without `/` that is not a Snowflake id is treated as
`root/<name>`.

### Raw content input

`create` / `update` accept content from three sources (mutually exclusive,
first match wins): `--file <path>`, `--raw <text>`, or piped stdin (when not
a TTY). `create` with none of the three opens `$EDITOR` on an empty buffer
when interactive, else fails with `ValidationFailed`.

`edit` opens the current `raw` in `$EDITOR` with a file extension derived
from `type`: `json` → `.json`, `json5` → `.json5`, `function` → `.js`,
`yaml` → `.yaml`, `text` → `.txt`. Unchanged buffer → emit "no changes" and
exit. Only `raw` is editable through the editor flow; metadata changes go
through `update` flags.

### Full-body PUT

Because `PUT /snippets/:id` validates the complete `SnippetDto`,
`update` and `edit` first `GET /snippets/:id`, merge the changed fields onto
the existing snippet, strip server-managed fields (`id`, `created`,
`updated`/timestamps), and PUT the merged body.

## Command surface

```
mxs snippet list [--page <n>] [--size <n>] [--grouped]
mxs snippet get <id|ref/name>
mxs snippet create --name <n> [--reference <r>] [--type <t>]
                   [--file <path> | --raw <text> | stdin]
                   [--private] [--comment <c>] [--enable | --no-enable]
                   [--method <m>] [--metatype <m>] [--schema <s>]
                   [--custom-path <p>] [--secret <k=v qs string>]
mxs snippet update <id|ref/name> [same flags as create, all optional]
mxs snippet edit <id|ref/name>
mxs snippet delete <id|ref/name> [--force]
```

- `list` → `GET /snippets`; `--grouped` → `GET /snippets/group`.
- `get` resolves the target then `GET /snippets/:id` (full, includes `raw`).
- `delete` refuses without `--force` in non-TTY contexts (same guard as
  `topic delete`).
- All output goes through `Renderer.emitSuccess` / `emitInfo`, matching the
  existing envelope-aware rendering and `--json` behavior.

## Files

- `src/cli/snippet/index.ts` — help registry + subcommand wiring
- `src/cli/snippet/_flags.ts` — shared write options + raw-source resolution
- `src/cli/snippet/_resolve.ts` — `<id|ref/name>` → id resolution
- `src/cli/snippet/{list,get,create,update,edit,delete}.ts`
- `src/bin/mxs.ts` — register `snippetCmd`

## Error handling

- Unresolvable target → `ResourceNotFound`
- Missing raw source for create (non-interactive) → `ValidationFailed`
- Editor/parse failures reuse existing `Editor` service error channel
- API errors flow through the existing `Api` error mapping; no new handling

## Testing

Follow the existing CLI test convention: `packages/cli/test/cli/*.test.ts`
(CRUD flows, e.g. `project-crud.test.ts`) and `test/integration/` for help
rendering. Add `test/cli/snippet-crud.test.ts` covering: target resolution
(`id`, `ref/name`, bare name, miss), raw-source precedence
(`--file` > `--raw` > stdin), full-body merge on update, and delete guard.
