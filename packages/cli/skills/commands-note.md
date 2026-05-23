---
slug: commands-note
title: Note commands
description: note list/get/create/edit/update/delete/publish/unpublish syntax
order: 31
---

# Note commands

| Command                       | Purpose                                                                                    | Principal flags                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `mxs note list`               | List notes.                                                                                | `--page <n>`, `--size <n>`, `--state <s>`, `--sort <s>` |
| `mxs note get <slugOrId>`     | Read by Snowflake id, numeric nid, or direct identifier.                                   | `--json`, `--output readable\|llm\|xml` |
| `mxs note create`             | Create a note.                                                                             | note write flags                      |
| `mxs note edit <slugOrId>`    | Edit via `$EDITOR` when no content flags are supplied; otherwise replace through flags or file. | note write flags                |
| `mxs note update <slugOrId>`  | Patch selected fields. Content remains unchanged unless `--content` or `--file` is supplied. | note write flags                    |
| `mxs note delete <slugOrId>`  | Delete a note.                                                                             | `--force`; prefer `--dry-run` first   |
| `mxs note publish <slugOrId>` | Set `isPublished=true`.                                                                    | supports `--dry-run`                  |
| `mxs note unpublish <slugOrId>` | Set `isPublished=false`.                                                                 | supports `--dry-run`                  |

## Note list flags

| Flag           | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `--page <n>`   | Page number.                                             |
| `--size <n>`   | Page size.                                               |
| `--state <s>`  | Publication filter.                                      |
| `--sort <s>`   | Sort field passed as `sortBy`.                           |

Compatibility note: verify the live note list query contract before using `--state`; do not assume post and note list filters accept the same value shape.

## Note write flags

| Flag                    | Field or behavior                                                |
| ----------------------- | ---------------------------------------------------------------- |
| `--title <s>`           | `title`; create defaults to `无题` when omitted.                  |
| `--slug <s>`            | `slug`                                                           |
| `--topic <s>`           | Topic id, slug, or name; resolved to `topicId`.                  |
| `--content <spec>`      | Body source; see `authoring`.                                    |
| `--format <s>`          | `lexical` or `markdown`; default is `lexical`.                   |
| `--state <s>`           | `publish` or `draft`; maps to `isPublished`.                     |
| `--mood <s>`            | `mood`                                                           |
| `--weather <s>`         | `weather`                                                        |
| `--public-at <iso>`     | `publicAt`                                                       |
| `--password <s>`        | `password`                                                       |
| `--bookmark <b>`        | `true` or `false`.                                               |
| `--coords <s>`          | `lat,lng`; maps to `{ latitude, longitude }`.                    |
| `--location <s>`        | `location`                                                       |
| `--images <spec>`       | JSON literal or `file=<path>`.                                   |
| `--meta <spec>`         | JSON literal or `file=<path>`.                                   |
| `--file <path>`         | LiteXML envelope.                                                |

Dry-run support: `create`, `edit`, `update`, `delete`, `publish`, `unpublish`.
