---
slug: commands-ai
title: AI commands
description: mxs ai — manage AI summary / translation / insights artifacts
order: 45
---

# AI commands

`mxs ai` manages every AI artifact the core server produces: per-article **summary**, per-article **translation**, per-article **insights**, plus the i18n **translation entries** dictionary used for category / topic / note metadata.

Article references (`<id>`) accept a Snowflake id, a post slug, or a numeric note nid. The CLI resolves through post first, then note. Record references (`<recordId>`) are raw Snowflakes — they are NOT resolved.

## Generate verbs (async)

`summary regen`, `translate run`, `insights refresh` enqueue a task and poll `GET /tasks/:id` until terminal (`succeeded` / `failed` / `cancelled`, or the spec-2 `completed` / `partial_failed` aliases). Progress lines write to stderr. `--no-wait` returns immediately with `status: pending`. If the server reports `created: false`, an in-flight deduplicated task already exists; the CLI joins it instead of erroring. Polling cadence is 1000 ms by default; override with `MXS_AI_POLL_MS=<ms>` for tests.

| Command                                              | Purpose                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `mxs ai summary regen <id> [--to <lang>...]`         | Regenerate an article's AI summary.                             |
| `mxs ai translate run <id> --to <lang>...`           | Translate an article into one or more languages (`--to` required, repeatable). |
| `mxs ai insights refresh <id> [--to <lang>...]`      | Refresh AI insights for an article.                             |

Common flags on the three generate verbs:

| Flag             | Effect                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `--to <lang>`    | Target language code (repeatable). Forwarded as `targetLanguages`. |
| `--no-wait`      | Return after task creation; print `status: pending` and exit 0.    |

On success the CLI emits an `ai-task` view: `taskId`, `status`, `refId`, `targetLanguages`, `totalTokens`, `totalCost` (cents), `resultIds`.

## Summary read / manage

| Command                                                       | Purpose                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| `mxs ai summary list [--page <n>] [--size <n>] [--grouped]`   | List summaries (flat or grouped by article).                  |
| `mxs ai summary get <recordId>`                               | Get one summary by record id.                                 |
| `mxs ai summary by-article <id> [--lang <l>] [--only-db]`     | Show an article's summary; `--only-db` skips auto-generation. |
| `mxs ai summary edit <recordId>`                              | Edit the `summary` field via `$EDITOR` (JSON envelope).       |
| `mxs ai summary delete <recordId> [--force]`                  | Delete a summary record. `--force` required in non-TTY.       |

## Translation read / manage

There is no flat list endpoint for translations server-side. `mxs ai translate list` is always grouped by article.

| Command                                                  | Purpose                                                  |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `mxs ai translate list [--page <n>] [--size <n>]`        | List translations (grouped by article).                  |
| `mxs ai translate get <recordId>`                        | Get one translation by record id.                        |
| `mxs ai translate by-article <id> [--lang <l>]`          | Show an article's translations (single lang or all).     |
| `mxs ai translate languages <id>`                        | List languages an article has been translated into.      |
| `mxs ai translate edit <recordId>`                       | Edit translation fields via `$EDITOR` (JSON envelope).   |
| `mxs ai translate delete <recordId> [--force]`           | Delete a translation record.                             |

Edit envelope keys: `title`, `text`, `subtitle` (nullable), `summary`, `tags`, `content`. Only included keys are PATCHed.

## Translation entries (i18n dictionary)

The dictionary layer used for category / topic / note metadata translations. `--key-path` accepts ONLY the server-validated set: `category.name`, `topic.name`, `topic.introduce`, `topic.description`, `note.mood`, `note.weather`.

| Command                                                                                     | Purpose                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `mxs ai translate entries list [--page <n>] [--size <n>] [--key-path <p>] [--lang <l>]`     | List entries with optional filters.                    |
| `mxs ai translate entries generate [--key-path <p>...] [--to <lang>...]`                    | Regenerate entries (synchronous on the server).        |
| `mxs ai translate entries edit <recordId>`                                                  | Edit `translatedText` via `$EDITOR` (JSON envelope).   |
| `mxs ai translate entries delete <recordId> [--force]`                                      | Delete an entry.                                       |

## Insights read / manage

| Command                                                       | Purpose                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `mxs ai insights list [--page <n>] [--size <n>] [--grouped]`  | List insights (flat or grouped by article).                    |
| `mxs ai insights get <recordId>`                              | Get one insights record by record id.                          |
| `mxs ai insights by-article <id> [--lang <l>] [--only-db]`    | Show an article's insights; `--only-db` skips auto-generation. |
| `mxs ai insights edit <recordId>`                             | Edit the `content` field via `$EDITOR` (JSON envelope).        |
| `mxs ai insights delete <recordId> [--force]`                 | Delete an insights record.                                     |

## Exit codes specific to `ai`

| Code   | When                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| `0`    | Task reached `succeeded`/`completed`; or `--no-wait`; or read/edit/delete completed.     |
| `1`    | `AiTaskCreateFailed` (no `taskId` in response) or `AiTaskFailed` (terminal `failed`/`cancelled`/`partial_failed`). |
| `7`    | `AiRecordNotFound` (`get`/`edit`/`delete` against a missing record).                     |

Network / auth / validation errors map per the global table — see `safety`.

## Examples

```bash
# Regenerate an article's summary and wait for it
mxs ai summary regen my-post --to en --to ja

# Translate to Japanese, fire and forget
mxs ai translate run my-post --to ja --no-wait

# Refresh insights, then read the result
mxs ai insights refresh my-post
mxs ai insights by-article my-post --only-db

# Inventory
mxs ai summary list --grouped --output json | jq .
mxs ai translate languages my-post

# Patch a translation record through $EDITOR
mxs ai translate edit 01HXXX...
```

## Notes for agents

- Always pass `--output json` (or `--json`) for machine-parseable output. The default `readable` mode is for humans.
- `created: false` is a normal join-existing path, NOT an error. Do not retry on it.
- The polling loop has no hard timeout. For very long translation runs across many languages, prefer `--no-wait` plus periodic `mxs ai translate by-article` polls.
- Edit envelopes are typed per resource. Unknown keys are rejected client-side before any PATCH is sent.
