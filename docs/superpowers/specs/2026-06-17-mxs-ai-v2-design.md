# `mxs ai` — v2 Wave 1 Design

Status: approved
Author: cc@innei.in
Date: 2026-06-17
Package: `@mx-space/cli` (`packages/cli`)

## Summary

Add a new top-level command group `mxs ai` to the CLI covering the three AI artifact families that the core server already exposes: `summary`, `translate`, and `insights`. Each family ships full management — generate, list, read by id, read by article, edit, delete — plus the translation-entries (i18n dictionary) sub-tree under `ai translate entries`. No new core endpoints are introduced.

A later wave will add `mxs ai tokens` (usage aggregation) and any agent / provider / key commands. Those are out of scope here.

## Goals

- Bring the AI module under the same management surface as `mxs post`, `mxs project`, `mxs snippet`: every artifact is reachable from the CLI for listing, inspection, editing, and deletion.
- Match the existing `mxs <resource> <verb>` shape — every action is a subcommand of its resource group, never a positional argument on the resource itself.
- Make async generate commands actually wait for the AI task to finish by default, so a CLI run that returns 0 means the artifact exists.
- Reuse the existing `Resolver` so users can pass an article id, slug, or title (same as `mxs post` / `mxs note`).

## Non-goals

- No `mxs ai tokens` / usage aggregation. Tracked separately on the roadmap.
- No provider / key / config management (`ai config`, `ai key add/rm`). Not on v2.
- No agent chat (`ai agent invoke`). Not on v2.
- No new core endpoints. Everything below targets routes that already exist.
- No streaming SSE consumption. The CLI uses the task queue path (`POST /ai/.../task` + `GET /tasks/:id`), not `/ai/.../article/:id/generate`. Streaming is admin-UI shaped, not CLI shaped.

## Server contract (existing)

### Summary
- `POST /ai/summaries/task` — `{ refId, targetLanguages?: string[] }` → `{ taskId, created }`.
- `GET  /ai/summaries/` — paginated; query: `BasicPagerDto`.
- `GET  /ai/summaries/grouped` — paginated, grouped per article.
- `GET  /ai/summaries/ref/:id` — array of summaries for one article.
- `GET  /ai/summaries/article/:id?lang=&onlyDb=` — single summary; will generate on miss unless `onlyDb=true`.
- `PATCH /ai/summaries/:id` — `{ summary: string }`.
- `DELETE /ai/summaries/:id`.

### Translation
- `POST /ai/translations/task` — `{ refId, targetLanguages?: string[] }` → `{ taskId, created }`.
- `GET  /ai/translations/grouped` — paginated, grouped per article. (There is no flat `GET /` for translations — by design.)
- `GET  /ai/translations/ref/:id` — array of translations for one article.
- `GET  /ai/translations/article/:id?lang=` — single translation for an article + lang.
- `GET  /ai/translations/article/:id/languages` — list of languages a given article has.
- `PATCH /ai/translations/:id` — `UpdateTranslationDto`.
- `DELETE /ai/translations/:id`.

### Translation entries (i18n dictionary)
- `POST   /ai/translations/entries/generate` — `{ keyPaths?: string[], targetLangs?: string[] }`.
- `GET    /ai/translations/entries/` — paginated; query: `{ keyPath?, lang?, page, size }`.
- `PATCH  /ai/translations/entries/:id` — `{ translatedText: string }`.
- `DELETE /ai/translations/entries/:id`.

### Insights
- `POST /ai/insights/task` — `{ refId, targetLanguages?: string[] }` → `{ taskId, created }`.
- `GET  /ai/insights/` — paginated; query: `BasicPagerDto`.
- `GET  /ai/insights/grouped` — paginated, grouped per article.
- `GET  /ai/insights/ref/:id` — array of insights for one article.
- `GET  /ai/insights/article/:id?lang=&onlyDb=` — single insights doc; will generate on miss unless `onlyDb=true`.
- `PATCH /ai/insights/:id` — `{ content: string }`.
- `DELETE /ai/insights/:id`.

### Task polling (shared)
- `GET /tasks/:id` — full task record including `status`, `totalCost`, `resultIds`. Terminal statuses: `succeeded | failed | cancelled`.

## User-facing commands

Global flags (`--json`, `--llm`, `--readable`, `--api-url`, `--token`, `--api-key`, `--profile`, `--dry-run`) are pre-parsed by `runtime-flags` and never declared on subcommands. `<id>` arguments accept article id, slug, or title and go through `Resolver`. `<record-id>` (summary/translation/insights/entry primary key) is always a raw Snowflake.

### `mxs ai summary`

| Verb | Signature | Backed by |
|---|---|---|
| `regen` | `<id> [--to <lang>...] [--no-wait]` | `POST /ai/summaries/task` + poll |
| `list`  | `[--page N] [--size N] [--grouped]` | `GET /ai/summaries/` or `/grouped` |
| `get`   | `<record-id>` | derived: `list` filter (see note) |
| `by-article` | `<id> [--lang <l>] [--only-db]` | `GET /ai/summaries/article/:id` or `/ref/:id` |
| `edit`  | `<record-id>` | `PATCH /ai/summaries/:id` via `$EDITOR` |
| `delete`| `<record-id>` | `DELETE /ai/summaries/:id` |

> **`get` note:** core does not expose `GET /ai/summaries/:id`. The CLI implements `get <record-id>` by paging `/grouped` (or `/ref/:id` when the caller also supplies `--ref`) and matching client-side. Same applies to translation `get` and insights `get`. If this proves slow in practice we add `GET /ai/<resource>/:id` server-side in a later patch — out of scope for this spec.

### `mxs ai translate`

| Verb | Signature | Backed by |
|---|---|---|
| `run` | `<id> --to <lang>... [--no-wait]` | `POST /ai/translations/task` + poll |
| `list` | `[--page N] [--size N]` (always grouped) | `GET /ai/translations/grouped` |
| `get` | `<record-id>` | derived; see `summary get` note |
| `by-article` | `<id> [--lang <l>]` | `GET /ai/translations/article/:id` or `/ref/:id` |
| `languages` | `<id>` | `GET /ai/translations/article/:id/languages` |
| `edit` | `<record-id>` | `PATCH /ai/translations/:id` via `$EDITOR` (JSON envelope) |
| `delete` | `<record-id>` | `DELETE /ai/translations/:id` |

`run` replaces the original `ai translate <id>` shape — verbs are subcommands, not positional args on the resource (convention `2b`).

### `mxs ai translate entries`

| Verb | Signature | Backed by |
|---|---|---|
| `list` | `[--page N] [--size N] [--key-path <p>] [--lang <l>]` | `GET /ai/translations/entries/` |
| `generate` | `[--key-path <p>...] [--to <lang>...]` | `POST /ai/translations/entries/generate` |
| `edit` | `<record-id>` | `PATCH /ai/translations/entries/:id` via `$EDITOR` |
| `delete` | `<record-id>` | `DELETE /ai/translations/entries/:id` |

`--key-path` accepts the server-enforced set only (`category.name`, `topic.name`, `topic.introduce`, `topic.description`, `note.mood`, `note.weather`). The CLI does **not** re-enumerate these — it forwards verbatim and lets the server reject unknown values. The README lists them once for discoverability.

### `mxs ai insights`

| Verb | Signature | Backed by |
|---|---|---|
| `refresh` | `<id> [--to <lang>...] [--no-wait]` | `POST /ai/insights/task` + poll |
| `list`    | `[--page N] [--size N] [--grouped]` | `GET /ai/insights/` or `/grouped` |
| `get`     | `<record-id>` | derived; see `summary get` note |
| `by-article` | `<id> [--lang <l>] [--only-db]` | `GET /ai/insights/article/:id` or `/ref/:id` |
| `edit`    | `<record-id>` | `PATCH /ai/insights/:id` via `$EDITOR` |
| `delete`  | `<record-id>` | `DELETE /ai/insights/:id` |

## Generate / wait UX

`summary regen`, `translate run`, `insights refresh` all share the same flow:

1. Resolve `<id>` to a Snowflake via `Resolver`.
2. `POST` to the task endpoint with `{ refId, targetLanguages? }`.
3. Receive `{ taskId, created }`.
4. If `--no-wait`: emit the view at `status: 'pending'` and return.
5. Else: poll `GET /tasks/:id` every `MXS_AI_POLL_MS` (default `1000`) until terminal.
6. Emit the final `AiTaskView`. Terminal `failed`/`cancelled` raises `AiTaskFailed`, exit 1.

`created: false` means a deduplicated in-flight task already exists. The CLI joins it (`[ai] joining existing task taskId=...` on stderr) and follows the existing `taskId` — never an error.

Progress lines (stderr only, suppressed when `--json` AND non-TTY):
```
[ai] task pending… taskId=01H...
[ai] task running…
[ai] task succeeded (4.8s)
```

`^C` aborts the in-flight HTTP request but does NOT cancel the server-side task (matches existing `mxs` behavior). Exit 130.

## `edit` UX

`edit` mirrors the existing `mxs project edit` flow:

1. Fetch current record. Summary uses `{ summary }`, insights uses `{ content }`, translation uses the `UpdateTranslationDto` envelope, entry uses `{ translatedText }`.
2. Write a minimal JSON envelope to a temp file, launch `$EDITOR`.
3. On editor exit with non-empty diff, parse JSON, PATCH the changed fields.
4. No-op when diff is empty.

Editor envelope shape is per-resource and lives in `src/cli/ai/<resource>/edit.ts`. JSON, not raw text — symmetric with `mxs project edit`.

## Output

A single view file `src/cli/ai/views.ts` defines five Zod-parsed views:

```ts
AiTaskView           // for regen / run / refresh
AiSummaryView        // for list / get / by-article
AiTranslationView    // for list / get / by-article
AiInsightsView       // for list / get / by-article
AiTranslationEntryView
```

All views are normalized in the CLI service layer — server records are NOT forwarded raw. This keeps a future server-side field rename contained.

Renderer modes follow existing conventions:

- `readable` (default): per-view tabular block or single-line summary.
- `json` / `pretty-json`: standard `{ ok, data }` envelope; list endpoints carry `pagination` in `meta`.
- `llm`: terse one-line per record.

## Exit codes

- `0` — task `succeeded` or read/edit/delete completed.
- `1` — `AiTaskFailed`, `AiTaskCreateFailed`, or any other tagged failure per `exitCodeForTag`.
- `130` — user ^C.

Resolver / network / auth errors are unchanged from the rest of the CLI.

## Architecture

### Service: `src/services/Ai.ts`

The v0.3 placeholder (`AiService = {}`, `Layer.effect(Ai, Effect.die(...))`) is replaced with a real interface. The `.Default` layer depends on `Api` and `Resolver`, both of which are already constructed in `bin/mxs.ts` after `parseGlobalFlags`. `Ai.Default` is registered alongside them via `Layer.provideMerge`, NOT in `layers/App.ts`.

```ts
export interface AiService {
  // generate
  readonly regenSummary:      (in: { refId; targetLanguages? }) => Effect<CreateTaskResult, ...>
  readonly translate:         (in: { refId; targetLanguages }) => Effect<CreateTaskResult, ...>
  readonly refreshInsights:   (in: { refId; targetLanguages? }) => Effect<CreateTaskResult, ...>
  readonly waitForTask:       (taskId, opts) => Effect<AiTaskView, AiTaskFailed | ApiError>

  // summary read/manage
  readonly listSummaries:     (q) => Effect<Paginated<AiSummaryView>, ApiError>
  readonly getSummary:        (id) => Effect<AiSummaryView, AiRecordNotFound | ApiError>
  readonly getSummariesByArticle: (refId, opts) => Effect<AiSummaryView | AiSummaryView[], ApiError>
  readonly updateSummary:     (id, patch) => Effect<AiSummaryView, ApiError>
  readonly deleteSummary:     (id) => Effect<void, ApiError>

  // translation read/manage — same shape
  readonly listTranslations, getTranslation, getTranslationsByArticle,
           getTranslationLanguages, updateTranslation, deleteTranslation

  // insights read/manage — same shape
  readonly listInsights, getInsights, getInsightsByArticle,
           updateInsights, deleteInsights

  // translation entries
  readonly listEntries, generateEntries, updateEntry, deleteEntry
}
```

Polling cadence defaults to 1000 ms and is overridable via `MXS_AI_POLL_MS` (for tests).

### Commands: `src/cli/ai/`

```
src/cli/ai/
  index.ts                # withSubcommands('summary', 'translate', 'insights')
  views.ts                # all AI views in one file
  shared/
    edit-envelope.ts      # JSON-editor helper (re-used by every edit verb)
    poll-task.ts          # waitForTask handler wiring + stderr progress
    resolve-article.ts    # wrap Resolver, restrict to post/note (no page)

  summary/
    index.ts              # regen, list, get, by-article, edit, delete
    regen.ts list.ts get.ts by-article.ts edit.ts delete.ts

  translate/
    index.ts              # run, list, get, by-article, languages, edit, delete, entries
    run.ts list.ts get.ts by-article.ts languages.ts edit.ts delete.ts
    entries/
      index.ts            # list, generate, edit, delete
      list.ts generate.ts edit.ts delete.ts

  insights/
    index.ts              # refresh, list, get, by-article, edit, delete
    refresh.ts list.ts get.ts by-article.ts edit.ts delete.ts
```

Every handler is a thin `Effect.gen` that `yield*`s `Ai` (and `Resolver` for `<id>`-bearing verbs), then `emit`s a parsed view. No business logic in handlers.

`bin/mxs.ts#rootCmd` registers the `ai` aggregator. `src/cli/help/` group metadata gains an `ai` entry; help-data builders enumerate the verb tree.

### Errors: `src/domain/errors.ts`

Three new `Data.TaggedError` classes added to `exitCodeForTag`:

- `AiTaskCreateFailed` — non-2xx from a `/ai/.../task` POST. Exit 1.
- `AiTaskFailed` — terminal `failed` / `cancelled` during `waitForTask`. Carries `{ taskId, status, message? }`. Exit 1.
- `AiRecordNotFound` — `get`/`edit`/`delete` referencing a missing record id. Exit 1.

### Resolver reuse

`<id>` arguments go through `Resolver`. The shared `shared/resolve-article.ts` constrains to post + note (pages have no AI generation surface) and surfaces `RefNotResolvable` on miss. `<record-id>` arguments skip the resolver — they are raw Snowflakes.

## File-size budget

The verb fan-out is wide but each file stays tiny. Each verb is 30–80 lines of `Effect.gen`. The service file is the only one that may push toward the 500-line ceiling; if it does, split per-family (`Ai.summary.ts`, `Ai.translation.ts`, `Ai.insights.ts`) under one `Ai.ts` aggregator. Same pattern as `Auth.ts`.

## Testing

Unit tests under `test/cli/ai/` mirror the directory layout. For each verb:

- happy path against `test-http.ts` canned responses.
- error path (404, 5xx, deduped task, failed task).
- resolver miss for `<id>` verbs.
- view shape rejection for malformed server payloads.

`waitForTask` gets its own test file: polling cadence, transition logging, ^C abort, terminal failure tagging.

Integration tests under `test/integration/`:

- `ai-task-flow.test.ts` — `mxs ai summary regen <id>` end-to-end against a canned HTTP server, asserts stderr progress lines, stdout JSON envelope, exit code.
- `ai-edit.test.ts` — `mxs ai summary edit <id>` with a mock `$EDITOR` script (existing helper from `mxs project edit` tests).

## Documentation

`packages/cli/README.md` gains an `mxs ai` section listing every verb under each family with one example per verb. `ROADMAP.md` v2 entry is updated:

- The full `mxs ai summary|translate|insights` surface moves to "Shipped in v0.7" (or whatever the next-version block is at PR time).
- `mxs ai tokens` stays under v2 with a note that it is the only remaining wave-2 item.

## Open questions

None. Deferred items (`tokens`, agent / provider / key) are explicitly out of scope.

## Rollout

Single PR, no core changes, no migration, no config flag. Placeholder `AiService = {}` is swapped atomically — the only callers are the new command files.
