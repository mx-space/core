---
slug: commands-category
title: Category commands
description: category list/get/create/update/delete syntax
order: 34
---

# Category commands

| Command                          | Purpose                          | Flags                                                                  |
| -------------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `mxs category list`              | List categories and tags.        | global flags                                                           |
| `mxs category get <slugOrId>`    | Read a category or tag.          | global flags                                                           |
| `mxs category create`            | Create a category or tag.        | required: `--name <s>`, `--slug <s>`; optional: `--type <s>`, `--icon <s>` |
| `mxs category update <slugOrId>` | Patch category or tag fields.    | `--name <s>`, `--slug <s>`, `--type <s>`, `--icon <s>`                 |
| `mxs category delete <slugOrId>` | Delete a category or tag.        | `--force`; prefer `--dry-run` first                                     |

`--type` accepts `category` or `tag` and maps to the server category type.

Dry-run support: `create`, `update`, `delete`.
