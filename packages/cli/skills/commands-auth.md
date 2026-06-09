---
slug: commands-auth
title: Auth commands
description: auth login/logout/whoami/status
order: 38
---

# Auth commands

| Command            | Purpose                                                                            | Notes                                                              |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `mxs auth login`   | Start device authorization flow and store credentials.                             | In interactive non-JSON mode, attempts to open verification URL.   |
| `mxs auth logout`  | Delete stored credentials.                                                         | Does not delete server-side sessions.                              |
| `mxs auth whoami`  | Show authenticated user and resolved API URL.                                      | Use before mutation target confirmation.                           |
| `mxs auth status`  | Show token presence, expiry, refresh-token availability, and user data.            | Use before write workflows.                                        |

`auth status` reads local CLI state. `auth whoami` validates bearer credentials against the configured server when a session token is available, then falls back to cached identity only when the server returns no session. It still does not prove write authorization; a target may allow authenticated identity reads while returning `auth.expired` or `auth.denied` for mutations. Treat the first real mutation, or a server-validated write-permission probe, as the authoritative write-auth check.

See `auth-config` for profiles, env vars, and target selection.
