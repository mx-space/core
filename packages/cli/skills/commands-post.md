---
slug: commands-post
title: Post commands
description: post list/get/create/edit/update/delete/publish/unpublish syntax
order: 30
---

# Post commands

| Command                       | Purpose                                                                                    | Principal flags                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `mxs post list`               | List posts.                                                                                | `--page <n>`, `--size <n>`, `--state <s>`, `--sort <s>` |
| `mxs post get <slugOrId>`     | Read a post by Snowflake id or slug.                                                       | `--json`, `--output readable\|llm\|xml` |
| `mxs post create`             | Create a post.                                                                             | post write flags                      |
| `mxs post edit <slugOrId>`    | Edit via `$EDITOR` when no content flags are supplied; otherwise replace through flags or file. | post write flags                |
| `mxs post update <slugOrId>`  | Patch selected fields. Content remains unchanged unless `--content` or `--file` is supplied. | post write flags                    |
| `mxs post delete <slugOrId>`  | Delete a post.                                                                             | `--force`; prefer `--dry-run` first   |
| `mxs post publish <slugOrId>` | Set `isPublished=true`.                                                                    | supports `--dry-run`                  |
| `mxs post unpublish <slugOrId>` | Set `isPublished=false`.                                                                 | supports `--dry-run`                  |

## Post list flags

| Flag           | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `--page <n>`   | Page number.                                             |
| `--size <n>`   | Page size.                                               |
| `--state <s>`  | Publication filter, commonly `draft` or `publish`.       |
| `--sort <s>`   | Sort field, commonly `created` or `modified`.            |

Compatibility note: `post list --state publish` may be rejected by the server as an invalid numeric `state`. Prefer omitting `--state` when listing through an anonymous or read-only context, or verify the live API contract before relying on this filter. `--sort created` is forwarded as `sortBy=created`; the server-side repository maps `createdAt`, `modifiedAt`, and `pinAt`, so verify ordering before treating the first row as latest.

## Post write flags

| Flag                    | Field or behavior                                                |
| ----------------------- | ---------------------------------------------------------------- |
| `--title <s>`           | `title`                                                          |
| `--slug <s>`            | `slug`                                                           |
| `--category <s>`        | Category id, slug, or name; resolved to `categoryId`.            |
| `--content <spec>`      | Body source; see `authoring`.                                    |
| `--format <s>`          | `lexical` or `markdown`; default is `lexical`.                   |
| `--summary <s>`         | `summary`                                                        |
| `--state <s>`           | `publish` or `draft`; maps to `isPublished`.                     |
| `--tags <csv>`          | Comma-separated tags.                                            |
| `--copyright <b>`       | `true` or `false`.                                               |
| `--pin <iso>`           | Pin timestamp or date.                                           |
| `--pin-order <n>`       | Numeric pin order.                                               |
| `--related <csv>`       | Comma-separated related document ids.                            |
| `--meta <spec>`         | JSON literal or `file=<path>`.                                   |
| `--file <path>`         | LiteXML envelope.                                                |

Dry-run support: `create`, `edit`, `update`, `delete`, `publish`, `unpublish`.
