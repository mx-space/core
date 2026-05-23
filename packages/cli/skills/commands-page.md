---
slug: commands-page
title: Page commands
description: page list/get/create/edit/update/delete syntax
order: 32
---

# Page commands

| Command                      | Purpose                                                                                    | Principal flags                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `mxs page list`              | List pages.                                                                                | global flags                          |
| `mxs page get <slugOrId>`    | Read by Snowflake id or slug.                                                              | `--json`, `--output readable\|llm\|xml` |
| `mxs page create`            | Create a page.                                                                             | page write flags                      |
| `mxs page edit <slugOrId>`   | Edit via `$EDITOR` when no content flags are supplied; otherwise replace through flags or file. | page write flags                 |
| `mxs page update <slugOrId>` | Patch selected fields. Content remains unchanged unless `--content` or `--file` is supplied. | page write flags                     |
| `mxs page delete <slugOrId>` | Delete a page.                                                                             | `--force`; prefer `--dry-run` first   |

## Page write flags

| Flag                  | Field or behavior                                              |
| --------------------- | -------------------------------------------------------------- |
| `--title <s>`         | `title`                                                        |
| `--slug <s>`          | `slug`                                                         |
| `--subtitle <s>`      | `subtitle`                                                     |
| `--order <n>`         | Numeric page order.                                            |
| `--content <spec>`    | Body source; see `authoring`.                                  |
| `--format <s>`        | `lexical` or `markdown`; default is `lexical`.                 |
| `--meta <spec>`       | JSON literal or `file=<path>`.                                 |
| `--file <path>`       | LiteXML envelope. Pages currently reuse `<mxpost>`.            |

Dry-run support: `create`, `edit`, `update`, `delete`.
