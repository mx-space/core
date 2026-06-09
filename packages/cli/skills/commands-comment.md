---
slug: commands-comment
title: Comment commands
description: comment list/get/approve/reject/delete + moderation safety
order: 34
---

# Comment commands

Moderation surface for the comment queue. State codes: `unread=0`, `read=1`, `junk=2`. The CLI accepts the *names* (`unread`, `read`, `junk`) on `--state`. Single-id verbs and `--all` invocations all route through the server's batch endpoints (`PATCH /comments/batch/state`, `DELETE /comments/batch`) — there is one unified code path.

| Command                            | Purpose                                              | Principal flags                                  |
| ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `mxs comment list`                 | List comments.                                       | `--page <n>`, `--size <n>`, `--state <unread\|read\|junk>` (default `unread`), `--all` |
| `mxs comment unread`               | Shortcut for `comment list --state unread`.          | `--page <n>`, `--size <n>`                       |
| `mxs comment get <id>`             | Show a single comment by id.                         | `--json`, `--output readable`                    |
| `mxs comment approve <id...>`      | Mark comments as read (state=1).                     | `--all`, `--state <s>`, `--force`                |
| `mxs comment reject <id...>`       | Mark comments as junk (state=2).                     | `--all`, `--state <s>`, `--force`                |
| `mxs comment delete <id...>`       | Soft-delete comments.                                | `--all`, `--state <s>`, `--force`                |

## Comment list flags

| Flag                              | Meaning                                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| `--page <n>`                      | Page number.                                                         |
| `--size <n>`                      | Page size.                                                           |
| `--state <unread\|read\|junk>`    | Filter by state. Default `unread`.                                   |
| `--all`                           | Aggregate every state into one response (three parallel requests; pagination is collapsed). |

## Comment moderation flags

| Flag             | Applies to                              | Effect                                                              |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `<id...>`        | approve, reject, delete                 | One or more comment ids. Mutually exclusive with `--all`.           |
| `--all`          | approve, reject, delete                 | Apply to every comment, optionally filtered by `--state` as `currentState`. |
| `--state <s>`    | approve, reject, delete with `--all`    | Restrict the affected set to comments currently in that state.      |
| `--force`        | delete (single id), any `--all`         | Required in non-TTY contexts to confirm destructive operations.     |

## Comment safety guards

| Operation                                                    | TTY     | Non-TTY                                |
| ------------------------------------------------------------ | ------- | -------------------------------------- |
| `approve <id...>` / `reject <id...>`                         | Direct. | Direct (state changes are soft and reversible). |
| `delete <id...>` (single or multi)                           | Direct. | Requires `--force`.                    |
| `approve --all` / `reject --all` / `delete --all`            | Direct. | Requires `--force`.                    |

Dry-run support: `approve`, `reject`, `delete` (single id or `--all`).
