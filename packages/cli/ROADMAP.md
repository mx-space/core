# `@mx-space/cli` Roadmap

## Shipped in v0.2

- Multi-environment profile system: named `(api_url, credentials)` bundles under `~/.config/mxs/profiles/<name>/`, `--profile` global flag, `MXS_PROFILE` env var, `mxs profile {ls,show,use,mark,rm}` subcommands, production write gate, and automatic migration from the legacy single-profile layout.

## Shipped in v0.3

- Internal rewrite onto Effect-TS (`@effect/cli` + `@effect/platform`). User-facing CLI surface is unchanged — see [`README.md`](./README.md#v030-behavior-changes) for the small list of behavioral adjustments and [`docs/architecture.md`](./docs/architecture.md) for the new internal architecture.

## Shipped in v0.6

- `mxs skill` — bundled AI-agent documentation. List, get, all, search across chapters shipped inside the CLI (`packages/cli/skills/*.md`); liteXML chapters loaded live from the installed `@haklex/rich-litexml` package. Default output is raw markdown for direct context injection.
- `mxs preview <file>` — local HTML preview of a LiteXML fragment or `<mxpost>` / `<mxnote>` envelope. Uses the vendored LiteXML preview renderer so the output matches the editor renderer without runtime package dependencies.
- `mxs project` — full CRUD for portfolio projects: `list`, `get`, `view`, `create`, `edit` ($EDITOR JSON envelope), `update`, `delete`. Resolver accepts unique `name` or Snowflake id. Server adds `PATCH /projects/:id`, a Zod DTO on create/update, and a `PROJECT_NAME_TAKEN` (409) error on duplicate names.

## Next — Comment moderation

- `mxs comment list [--page N] [--size N] [--state unread|read|junk] [--all]`
- `mxs comment get <id>`
- `mxs comment approve <id...> | --all [--state <s>]`
- `mxs comment reject <id...> | --all [--state <s>]`
- `mxs comment delete <id...> | --all [--state <s>] [--force]`

State map: `unread=0`, `read=1`, `junk=2`. Routes single-id verbs through the server's batch endpoints (`PATCH /comments/batch/state`, `DELETE /comments/batch`) for one unified path.

## Shipped in v0.13

- `mxs ai` — full management surface for AI artifacts.
  - `mxs ai summary {regen,list,get,by-article,edit,delete}`
  - `mxs ai translate {run,list,get,by-article,languages,edit,delete}`
  - `mxs ai translate entries {list,generate,edit,delete}`
  - `mxs ai insights {refresh,list,get,by-article,edit,delete}`
  - Generate verbs enqueue a task on the server and poll `GET /tasks/:id` until terminal; `--no-wait` returns the `taskId` immediately. Dedup-aware: `created: false` joins the in-flight task.

## v2 — AI tokens / usage

- `mxs ai tokens` — aggregate `totalCost` and `totalTokens` across recent AI tasks. Pending a final decision on client-side aggregation vs. a dedicated `/ai/usage` endpoint on the server.

## v3

- Maintenance
  - `mxs cache clear [--scope=all|view|post|note|page|aggregate]`
  - `mxs cache stats`
  - `mxs search reindex`
  - `mxs search status`
  - `mxs job list`
  - `mxs job run <name>`
  - `mxs health`
- Backup
  - `mxs backup create [--output <path>]`
  - `mxs backup list`
  - `mxs backup download <id> [--output <path>]`
  - `mxs backup restore <id-or-file> [--force]`
- Export / import (content as files)
  - `mxs export <dir> [--type=post,note,page] [--format=markdown|litexml]`
  - `mxs import <dir> [--type=post] [--update-existing]`
- Observability
  - `mxs logs tail`
  - `mxs metrics`
- OS keychain storage (keytar / libsecret) once monorepo Node version stabilizes
- `mxs init` — bootstrap a fresh mx-core deployment via compose
