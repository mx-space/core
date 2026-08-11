# mxs ai — align with core AI changes since #2753

Date: 2026-08-11
Status: approved

## Background

The `mxs ai` surface (PR #2753, 2026-06-17) targets core's summary / translation /
insights endpoints. Since then core accumulated 27 AI commits; the most recent
(#2804) added multi-language + force regeneration on task creation and a
per-article AI overview board. No existing CLI endpoint broke — the gap is new
capability only.

Scope decision (user): task parameters + read-only `overview` group. TTS /
image / writer / agent surfaces are out of scope.

## Core deltas being aligned

- `force?: boolean` on `POST /ai/summaries/task`, `POST /ai/translations/task`,
  `POST /ai/insights/task`.
- `targetLanguages?: string[]` (server cap `MAX_LANGS_PER_TASK = 8`) on
  `POST /ai/insights/task`.
- New `POST /ai/summaries/task/translate` — `{ refId, targetLang, force? }`;
  responds `{ taskId: null, created: false, reason: 'source-missing' }` when no
  base summary exists. `POST /ai/insights/task/translate` is the pre-existing
  analog the CLI never exposed.
- `search?: string` on all three `/grouped` list endpoints.
- New `GET /ai/overview/grouped` (`page`, `size`, `search`, `type` ∈
  post|note|page) and `GET /ai/overview/article/:id`.
- Task polling endpoint `/tasks/:id` unchanged; new task type strings
  `ai:summary:translation` (display concern only).

## CLI surface

All flags follow existing conventions (`--to` repeatable, `--no-wait`).

| Command | Change |
| --- | --- |
| `ai summary regen` | add `--force` |
| `ai translate run` | add `--force` |
| `ai insights refresh` | add `--to` (repeatable, ≤8) and `--force` |
| `ai summary translate <idOrSlug> --to <lang> [--force] [--no-wait]` | new; `POST /ai/summaries/task/translate` |
| `ai insights translate <idOrSlug> --to <lang> [--force] [--no-wait]` | new; `POST /ai/insights/task/translate` |
| `ai summary list` / `ai translate list` / `ai insights list` | add `--search` |
| `ai overview list [--page --size --search --type post\|note\|page]` | new; `GET /ai/overview/grouped` |
| `ai overview by-article <idOrSlug>` | new; `GET /ai/overview/article/:id` |

`translate` inside `summary`/`insights` takes a single `--to` (server contract
is one `targetLang` per task), unlike the repeatable `--to` on generation verbs.
The ≤8 language cap is enforced server-side only; the CLI passes values through
and surfaces the server's validation error, matching existing verbs.

## Service layer

`src/services/Ai.ts` (619 lines, already past the 500-line cap) becomes a
directory, following the `services/Renderer/` precedent — the import specifier
`'../services/Ai'` keeps resolving, so call sites do not change:

- `src/services/Ai/index.ts` — `Ai` Tag, `Default` layer, `layer(api)` test
  helper, public types (re-exported so existing imports keep working).
- `src/services/Ai/tasks.ts` — task creation (`createTask`, new
  `translateSummary` / `translateInsights`), `waitForTask` polling.
- `src/services/Ai/resources.ts` — list/get/by-article/update/delete for
  summary, translation, insights, entries.
- `src/services/Ai/overview.ts` — `listOverview`, `getOverviewByArticle`.

API additions on `AiService`:

- `AiTaskCreateInput` gains `force?: boolean`; `refreshInsights` accepts
  `targetLanguages` + `force` (same shape as `regenSummary`).
- `translateSummary` / `translateInsights`:
  `{ refId, targetLang, force? }` → `AiTaskCreateResult`.
- `AiListQuery` gains `search?: string`.
- `listOverview({ page?, size?, search?, type? })`,
  `getOverviewByArticle(refId)` → `unknown` passthrough.
- `AiTaskType` union gains `'summary_translation' | 'insights_translation'`
  (display only; polling stays on `/tasks/:id`).

## Error handling

`readCreateTask` currently fails with a generic "server returned no taskId"
when `taskId` is null. The translate endpoints return
`{ taskId: null, created: false, reason: 'source-missing' }` in the normal
course — map that to `AiTaskCreateFailed` with the message
"no base summary/insights to translate — run `mxs ai summary regen` /
`mxs ai insights refresh` first" (per resource). Other null-taskId responses
keep the generic message.

## Rendering

`overview list` / `overview by-article` use `renderer.emitSuccess(res)`
passthrough like existing list verbs. Task-producing verbs reuse `aiTaskView`.
No new views.

## Registration

New `overview` sub-group registered in `src/cli/ai/index.ts`
(`Command.withSubcommands`) and in the `ai` group's `registerCommandHelp` verbs.
No new top-level group, so `bin/mxs.ts` and `src/cli/help/` group metadata are
untouched.

## Tests

Unit tests with canned `HttpClient` (`test/helper/test-http.ts`):

- `--force` / `--to` propagate into request bodies (regen, run, refresh).
- `summary translate` / `insights translate` happy path and `source-missing`
  → `AiTaskCreateFailed` with the actionable message.
- `--search` propagates into the grouped list query.
- `overview list` (query propagation incl. `--type`) and `overview by-article`.
- Existing `Ai` service tests keep passing after the directory split.

## Docs

- `packages/cli/README.md` — new verbs/flags (mandated by agents.md).
- Skill chapter `commands-ai` (`packages/cli/skills/`) — same additions.

## TTS group (scope extension, user-approved)

`mxs ai tts` mirrors the `/ai/tts` admin surface:

| Command | Endpoint |
| --- | --- |
| `ai tts run <idOrSlug> [--to <lang>...] [--force] [--no-wait]` | `POST /ai/tts/task` — body `{ refId, langs?, force? }` (wire field is `langs`, ≤8, server-normalized) |
| `ai tts list [--page --size --grouped --search]` | `GET /ai/tts/` (flat) / `GET /ai/tts/grouped` |
| `ai tts by-article <idOrSlug>` | `GET /ai/tts/ref/:id` (admin rows; NOT the public `/article/:id` narration endpoint, which is password-gated and single-lang) |
| `ai tts voices --provider <id> --model <m>` | `GET /ai/tts/voices?providerId&model` (both required) |
| `ai tts delete <recordId> [--force]` | `DELETE /ai/tts/:id` |

Service: `AiTaskType` gains `'tts'`; `runTts` maps CLI `targetLanguages` onto
the wire's `langs`; `createTask` also reads `body.langs` for the result view.
`listTts`, `getTtsByArticle`, `discoverTtsVoices`, `deleteTts` follow existing
patterns. Task polling unchanged.

## Out of scope

- `ai image` / `ai writer` / `ai agent` groups.
- Translation `/task/batch`, `/task/all` (deliberately unexposed since #2753).
- Client-side rendering of overview board beyond JSON passthrough.
