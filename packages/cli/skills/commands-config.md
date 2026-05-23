---
slug: commands-config
title: Config commands
description: server-side options — config list/get/set/edit
order: 36
---

# Config commands

`config` reads and writes the live `/options` document on the server. These affect server behavior — confirm intent before mutating.

| Command                          | Purpose                                                                  | Flags                                       |
| -------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| `mxs config list`                | Read all server options from `/options`.                                 | global flags                                |
| `mxs config get <key>`           | Read one server option.                                                  | global flags                                |
| `mxs config set <key> <value>`   | Patch one server option.                                                 | `--type json\|string\|number\|bool`         |
| `mxs config edit`                | Open all options in `$EDITOR`, then patch changed JSON values.           | supports `--dry-run`                        |

Without `--type`, `config set` attempts JSON parsing first and falls back to string.

Dry-run support: `set`, `edit`.

## Read-back

```bash
mxs config get <key> --json
mxs config list --json
```

Verify only the intended option changed.
