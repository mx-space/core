---
slug: commands-profile
title: Profile commands
description: local CLI profiles — profile ls/show/use/mark/rm
order: 39
---

# Profile commands

Profiles are stored under `~/.config/mxs/profiles/<name>/` and let one workstation talk to multiple `mx-core` deployments. The currently active profile is recorded in `~/.config/mxs/current`.

| Command                                              | Purpose                                            |
| ---------------------------------------------------- | -------------------------------------------------- |
| `mxs profile ls`                                     | List all known profiles.                           |
| `mxs profile show [<name>]`                          | Show one profile (defaults to active).             |
| `mxs profile use <name>`                             | Switch the active profile.                         |
| `mxs profile mark <name> [--production\|--no-production]` | Flag a profile as production or non-production. |
| `mxs profile rm <name> [--force]`                    | Delete a profile.                                  |

A profile flagged as production triggers an additional write guard — mutations require an explicit `--profile <name>` argument (the `profile.write_requires_explicit` error). This avoids accidental writes to production from a current-profile slip.

See `auth-config` for env vars and target selection rules.
