---
slug: commands-snippet
title: Snippet commands
description: snippet list/get/create/update/edit/delete syntax
order: 37
---

# Snippet commands

| Command                              | Purpose                                                                  | Principal flags                          |
| ------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------- |
| `mxs snippet list`                   | List snippets (lean, no `raw`).                                          | `--page <n>`, `--size <n>`, `--grouped`  |
| `mxs snippet get <id\|ref/name>`     | Read one snippet in full, including `raw`.                               | global flags                             |
| `mxs snippet create`                 | Create a snippet. `--name` is required.                                  | snippet write flags                      |
| `mxs snippet update <id\|ref/name>`  | Update fields and/or content; full-body merge onto the existing snippet. | snippet write flags                      |
| `mxs snippet edit <id\|ref/name>`    | Open the current `raw` in `$EDITOR`; PUT on save when the buffer changed. | global flags                            |
| `mxs snippet delete <id\|ref/name>`  | Delete a snippet.                                                        | `--force`; required in non-TTY contexts  |

`--grouped` lists snippets grouped by `reference` (`GET /snippets/group`).

## Identifier resolution

`<id|ref/name>` accepts:

- a Snowflake id (`/^\d{15,}$/`) — passed through unchanged,
- `<reference>/<name>` — resolved via `GET /snippets/group/:reference` and an exact `name` match,
- a bare name without `/` — treated as `root/<name>`.

No match exits 7 with `resource.not_found`.

## Snippet write flags

| Flag                         | Field        | Notes                                                          |
| ---------------------------- | ------------ | --------------------------------------------------------------- |
| `--name <s>`                 | `name`       | Required on `create`. Must match `/^[\w.-]{1,30}$/`.            |
| `--reference <r>`            | `reference`  | Defaults to `root` server-side.                                 |
| `--type <t>`                 | `type`       | `json` (default), `json5`, `function`, `text`, or `yaml`.       |
| `--file <path\|->`           | `raw`        | Read content from a file; `-` reads stdin.                      |
| `--raw <text>`               | `raw`        | Inline content.                                                 |
| `--private` / `--no-private` | `private`    | Tri-state: omit both to leave unchanged on `update`.            |
| `--comment <s>`              | `comment`    |                                                                 |
| `--enable` / `--no-enable`   | `enable`     | Tri-state, same as `--private`.                                 |
| `--method <m>`               | `method`     | `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, or `ALL` (function).   |
| `--metatype <s>`             | `metatype`   |                                                                 |
| `--schema <s>`               | `schema`     |                                                                 |
| `--custom-path <p>`          | `customPath` |                                                                 |
| `--secret <k=v>`             | `secret`     | qs string; function snippets only.                              |

## Raw content sources

Mutually exclusive, first match wins: `--file`, then `--raw`.

- `create` additionally falls back to piped stdin when stdin is not a TTY. With no source at all it opens `$EDITOR` on an empty buffer when interactive, else exits 5 with `validation.failed`.
- `update` never reads stdin implicitly — pass `--file -` to read stdin explicitly. Without a content flag, `raw` is left unchanged.

```bash
mxs snippet create --name theme --reference web --type json --file theme.json
echo '{"a":1}' | mxs snippet create --name config
cat new.json | mxs snippet update web/theme --file -
mxs snippet update web/theme --no-private
```

## Full-body PUT

`PUT /snippets/:id` validates the complete snippet, so `update` and `edit` first `GET /snippets/:id`, merge the changed fields onto the existing snippet, strip server-managed fields (`id`, timestamps), and PUT the merged body. Missing flags leave fields untouched.

## Editor flow

`mxs snippet edit` opens the current `raw` in `$EDITOR` with a file extension derived from `type` (`json` → `.json`, `json5` → `.json5`, `function` → `.js`, `yaml` → `.yaml`, `text` → `.txt`). An unchanged buffer emits `no changes` and makes no write. Only `raw` is editable here; metadata changes go through `update` flags.

## Dry-run support

`create`, `update`, `edit`, `delete` all honour the global `--dry-run` flag.
