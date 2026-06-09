---
slug: commands-topic
title: Topic commands
description: topic list/get/create/update/delete syntax
order: 36
---

# Topic commands

| Command                       | Purpose                                | Flags                                                                  |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `mxs topic list`              | List all topics.                       | global flags                                                           |
| `mxs topic get <slugOrId>`    | Read a topic by Snowflake id or slug.  | global flags                                                           |
| `mxs topic create`            | Create a topic.                        | required: `--name <s>`, `--slug <s>`; optional: `--description <s>`, `--icon <s>` |
| `mxs topic update <slugOrId>` | Patch topic fields.                    | `--name <s>`, `--slug <s>`, `--description <s>`, `--icon <s>`          |
| `mxs topic delete <slugOrId>` | Delete a topic.                        | `--force`; prefer `--dry-run` first                                     |

Dry-run support: `create`, `update`, `delete`.
