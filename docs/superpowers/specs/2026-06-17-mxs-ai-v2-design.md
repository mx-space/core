# `mxs ai` — v2 Wave 1 Design

Status: approved
Author: cc@innei.in
Date: 2026-06-17
Package: `@mx-space/cli` (`packages/cli`)

## Summary

Add a new top-level command group `mxs ai` to the CLI. This first wave of v2 ships three async generation commands backed by the existing core AI task queue:

- `mxs ai summary regen <id> [--to <lang>...]` — regenerate an article's AI summary.
- `mxs ai translate <id> --to <lang>... ` — translate an article into one or more target languages.
- `mxs ai insights refresh <id> [--to <lang>...]` — regenerate an article's AI insights.

A second wave (`mxs ai tokens`, plus any read commands) is deferred and is out of scope for this spec.

## Goals

- Bring the first slice of the ROADMAP v2 AI section online.
- Match the existing `mxs <resource> <verb>` command shape so the surface is predictable.
- Wait for task completion by default, so a CLI run that "returns 0" really means the AI artifact was produced.
- Surface task progress (`pending → running → succeeded/failed`) through `stderr` without polluting `stdout` (so `--json` and `--llm` outputs stay clean).
- Reuse the existing `Resolver` so users can pass a slug, title, or Snowflake id (same as `mxs post` / `mxs note`).

## Non-goals

- No `mxs ai tokens` / usage aggregation in this wave. Tracked separately.
- No read commands (`ai summary list`, `ai translate get`, etc.). Tracked separately.
- No provider/key/config management (`ai config`, `ai key add/rm`). Not on the v2 roadmap.
- No agent chat (`ai agent invoke`). Not on the v2 roadmap.
- No new core endpoints. The CLI consumes endpoints that already exist.

## Server contract (existing)

All three commands target existing core endpoints. No core changes are required for this wave.

| Command | Method | Path | Body |
|---|---|---|---|
| `ai summary regen` | `POST` | `/ai/summaries/task` | `{ refId, targetLanguages?: string[] }` |
| `ai translate` | `POST` | `/ai/translations/task` | `{ refId, targetLanguages: string[] }` |
| `ai insights refresh` | `POST` | `/ai/insights/task` | `{ refId, targetLanguages?: string[] }` |

Each endpoint responds with `{ taskId: string, created: boolean }`. `created: false` means a deduplicated in-flight task already exists for `(type, payload)` — the CLI MUST treat this as a non-error and follow the existing `taskId` instead of creating a new one.

Polling uses the existing task controller:

- `GET /tasks/:id` — returns the full task record, including `status`, `totalCost`, and any `resultIds`.

Terminal task statuses are `succeeded`, `failed`, `cancelled`. The CLI polls until one of these is reached or the user aborts.

## User-facing commands

### `mxs ai summary regen <id> [--to <lang>...] [--no-wait]`

- `<id>` — article id, slug, or title. Resolved through `Resolver` (post / note / page).
- `--to <lang>` — optional, repeatable. Passed to the server as `targetLanguages`.
- `--no-wait` — fire-and-forget; print `taskId` and exit.

### `mxs ai translate <id> --to <lang>... [--no-wait]`

- `<id>` — article id, slug, or title.
- `--to <lang>` — **required**, repeatable. At least one value.
- `--no-wait` — fire-and-forget.

### `mxs ai insights refresh <id> [--to <lang>...] [--no-wait]`

- `<id>` — article id, slug, or title.
- `--to <lang>` — optional, repeatable. Defaults to the server's default language when omitted.
- `--no-wait` — fire-and-forget.

Global flags (`--json`, `--llm`, `--readable`, `--api-url`, `--token`, `--api-key`, `--profile`, `--dry-run`) follow the existing `runtime-flags` pre-parser. None of these flags are declared on the new subcommands.

## Output

All three commands emit a single `AiTaskView` value via `Renderer.emit`:

```ts
type AiTaskView = {
  taskId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  type: 'summary' | 'translation' | 'insights'
  refId: string
  targetLanguages?: string[]
  totalTokens?: number
  totalCost?: number     // cents, matching core's totalCost field
  resultIds?: string[]   // present on succeeded
  error?: { message: string }  // present on failed
}
```

- `readable` (default): a single-line summary plus a key/value block, e.g.
  ```
  ai summary task succeeded
    taskId        01H...
    refId         01H...
    totalTokens   1284
    totalCost     0.42 ¢
    resultIds     01H...
  ```
- `json` / `pretty-json`: the `AiTaskView` wrapped in the standard `{ ok, data }` envelope.
- `llm`: terse single-line `succeeded summary refId=... taskId=... tokens=... cost=...`.

Progress (when not `--no-wait`) is written to `stderr` as plain text:
```
[ai] task pending… taskId=01H...
[ai] task running…
[ai] task succeeded (4.8s)
```

`stderr` lines are suppressed when `--json` is given AND the process is non-TTY, to keep CI logs clean — same convention used by `mxs post create`.

## Exit codes

- `0` — task reached `succeeded` (wait mode), or task was created (`--no-wait`).
- `1` — task reached `failed` or `cancelled`. The view still emits with `status` and `error` populated; the renderer reports the failure as a non-zero exit by mapping it to a new tagged error `AiTaskFailed`.
- Other existing tags map per `exitCodeForTag` — auth errors, network errors, resolver errors are unchanged.

## Architecture

### Service: `src/services/Ai.ts`

The v0.3 placeholder (`AiService = {}`, `Layer.effect(Ai, Effect.die(...))`) is replaced with a real interface and `.Default` layer wired through `Api` and `Resolver` (which are already constructed in `bin/mxs.ts` after `parseGlobalFlags`).

```ts
export interface AiService {
  readonly regenSummary: (
    input: { refId: string; targetLanguages?: string[] },
  ) => Effect.Effect<CreateTaskResult, AiTaskCreateFailed | ApiError>
  readonly translate: (
    input: { refId: string; targetLanguages: string[] },
  ) => Effect.Effect<CreateTaskResult, AiTaskCreateFailed | ApiError>
  readonly refreshInsights: (
    input: { refId: string; targetLanguages?: string[] },
  ) => Effect.Effect<CreateTaskResult, AiTaskCreateFailed | ApiError>
  readonly waitForTask: (
    taskId: string,
    opts?: { pollMs?: number; type: 'summary' | 'translation' | 'insights' },
  ) => Effect.Effect<AiTaskView, AiTaskFailed | ApiError>
}

type CreateTaskResult = { taskId: string; created: boolean }
```

`.Default` is `Layer.effect(Ai, Effect.gen(function*() { const api = yield* Api; ... }))`. It is registered in `bin/mxs.ts` alongside the other flag-dependent layers via `Layer.provideMerge`, NOT in `layers/App.ts`. Polling cadence defaults to 1000 ms and is overridable via a `MXS_AI_POLL_MS` env var (for tests).

### Commands: `src/cli/ai/`

```
src/cli/ai/
  index.ts           # withSubcommands('summary', 'translate', 'insights')
  summary/
    index.ts         # withSubcommands('regen')
    regen.ts
  translate.ts       # single verb directly under `ai translate`
  insights/
    index.ts         # withSubcommands('refresh')
    refresh.ts
```

Each handler is a thin `Effect.gen` that:

1. `yield*`s `Resolver` to turn `<id>` into a Snowflake id.
2. `yield*`s `Ai` to create the task.
3. If `--no-wait`: emit `{ status: 'pending', taskId, ... }` and return.
4. Else: `yield*` `Ai.waitForTask(taskId, { type })` and emit the resulting `AiTaskView`.

`bin/mxs.ts#rootCmd` registers the new aggregator. `src/cli/help/` group metadata and help data builders are updated for the `ai` group (title, one-line description, verb list).

### Errors: `src/domain/errors.ts`

Two new `Data.TaggedError` classes:

- `AiTaskCreateFailed` — wraps a non-2xx response from `/ai/.../task`. Exit code `1`.
- `AiTaskFailed` — terminal `failed` / `cancelled` status during `waitForTask`. Carries `{ taskId, status, message? }`. Exit code `1`.

Both are added to `exitCodeForTag`. The top-level `catchAll` shim in `bin/mxs.ts` already renders tagged errors through `emitError` — no changes there.

### Views: `src/cli/ai/views.ts`

Single `AiTaskView` schema (Zod, matching the other `*.views.ts` files in `src/cli/`). The view is parsed from a normalized in-memory object the service constructs from the task record — the CLI does NOT pass server task records through to the renderer untransformed, so future server-side field renames stay contained.

### Resolver reuse

`Resolver` already exposes the post/note/page lookup that `mxs post`, `mxs note`, etc. use. The AI commands call `Resolver.resolveArticle(idOrSlugOrTitle)` (existing) and pass the resulting Snowflake id through to the server. Pages are not currently in scope for any AI generation endpoint, so the resolver call is constrained to post + note in the handler — pages produce a `RefNotResolvable` error at the resolver layer.

## Polling behavior

`waitForTask` polls `GET /tasks/:id` every `pollMs` (default 1000) and:

- Logs `[ai] task <status>…` to stderr when the status changes.
- Aborts on `SIGINT` — the in-flight HTTP request is cancelled; the task on the server is NOT cancelled (matches existing `mxs` behavior elsewhere). Exit code is the standard 130.
- Treats a non-2xx response as `ApiError` and surfaces it through the existing error envelope.
- Has no hard timeout. Long-running tasks (translation across many locales) are normal; the user can `--no-wait` or ^C.

If the initial create returned `created: false` (deduplicated), the CLI logs `[ai] joining existing task taskId=...` and follows it the same way.

## Testing

Unit tests under `test/cli/ai/`:

- `summary-regen.test.ts`, `translate.test.ts`, `insights-refresh.test.ts` — `it.effect` with canned `test-http.ts` layer asserting:
  - happy path: create returns `{taskId, created: true}`, two polls return `pending` then `succeeded`, view shape is correct.
  - dedup path: create returns `{taskId, created: false}`, stderr contains `joining existing task`.
  - failed path: poll returns `failed` with `error.message`; handler exits with `AiTaskFailed`.
  - `--no-wait`: no `/tasks/:id` request is made; output is `pending`.
  - resolver miss: unknown slug → `RefNotResolvable`, no `/ai` request is made.
- `ai-views.test.ts` — view parsing rejects invalid status / missing fields.

Integration test under `test/integration/`:

- `ai-task-flow.test.ts` — spawns `mxs ai summary regen <id>` against a tiny canned HTTP server, asserts stderr progress lines, stdout JSON envelope, exit code.

Existing test helpers (`test-fs`, `test-http`) cover everything required.

## Documentation

`packages/cli/README.md` gains an `mxs ai` section under the command reference, with one usage example per verb. `ROADMAP.md` v2 entry is updated: the three commands move to a new "Shipped in v0.7" (or current next-version) block; `mxs ai tokens` stays under v2 with a note that read/usage commands are pending.

## Open questions

None. The deferred items (`tokens`, read commands, agent invoke) are explicitly out of scope and tracked separately on the roadmap.

## Rollout

Single PR. No core changes, no migration, no config flag. The placeholder `AiService = {}` in `src/services/Ai.ts` is replaced atomically with the new interface; the only callers are the new command files, so the swap is local to this change set.
