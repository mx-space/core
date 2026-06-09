---
slug: commands-project
title: Project commands
description: project list/get/view/create/edit/update/delete syntax
order: 33
---

# Project commands

| Command                          | Purpose                                                                              | Principal flags                         |
| -------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------- |
| `mxs project list`               | List portfolio projects.                                                             | `--page <n>`, `--size <n>`              |
| `mxs project get <nameOrId>`     | Read a project by Snowflake id or unique `name` (raw envelope).                       | `--json`, `--output readable\|llm`       |
| `mxs project view <nameOrId>`    | Render a project for terminal / LLM consumption.                                     | `--output readable\|llm`                 |
| `mxs project create`             | Create a project. `--name` and `--description` are required.                          | project write flags                     |
| `mxs project edit <nameOrId>`    | Open `$EDITOR` against a JSON envelope of editable fields; PATCH on save when the buffer changed. | `--open`, `--silent`           |
| `mxs project update <nameOrId>`  | Patch selected fields. Missing flags leave the field untouched.                       | project write flags                     |
| `mxs project delete <nameOrId>`  | Delete a project.                                                                    | `--force`; required in non-TTY contexts |

## Identifier resolution

`<nameOrId>` accepts:

- a Snowflake id (`/^\d{15,}$/`) — passed through unchanged,
- the project's unique `name` — resolved client-side via `GET /projects/all` and a case-insensitive `name` match. No `slug` field exists.

A duplicate `name` on create or update is rejected by the server with `PROJECT_NAME_TAKEN` (HTTP 409).

## Project write flags

| Flag                   | Field             | Notes                                                       |
| ---------------------- | ----------------- | ----------------------------------------------------------- |
| `--name <s>`           | `name`            | Required on `create`. Server-enforced unique (max 80 chars). |
| `--description <s>`    | `description`     | Required on `create` (max 500 chars).                       |
| `--preview-url <url>`  | `previewUrl`      | http(s) URL. Pass empty via `--file` to clear.              |
| `--project-url <url>`  | `projectUrl`      | http(s) URL.                                                |
| `--doc-url <url>`      | `docUrl`          | http(s) URL.                                                |
| `--avatar <url>`       | `avatar`          | http(s) URL.                                                |
| `--images <csv>`       | `images`          | Comma-separated list of URLs (≤ 20).                         |
| `--text <s>`           | `text`            | Free-form plain text (max 50_000 chars).                    |
| `--file <path>`        | (merge)           | JSON object whose recognised keys merge in first; per-flag values override. |
| `--open`               | —                 | Open the admin page (`#/projects/<id>`) after success.       |
| `--silent`             | —                 | Emit `{ ok: true }` instead of the full row on success.      |

## Edit envelope

`mxs project edit` writes a pretty-printed JSON object covering every editable field (clearable fields appear as `null`), spawns `$EDITOR`, and on save:

- byte-identical buffer → `no changes`, no API call;
- malformed JSON → exits with `validation.json` (exit code 5);
- otherwise → `PATCH /projects/:id` with the parsed body. Missing keys are no-ops; explicit `null` clears the column.

`id` and `createdAt` are intentionally excluded from the envelope.

## Dry-run support

`create`, `edit`, `update`, `delete` all honour the global `--dry-run` flag.
