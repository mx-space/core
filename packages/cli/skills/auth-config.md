---
slug: auth-config
title: Profiles, env vars, target selection
description: how to confirm and override the deployment the CLI is talking to
order: 50
---

# Auth, config, and target selection

Use this reference before target-sensitive operations.

## Target confirmation

| Step              | Command                                                       | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Auth state        | `mxs auth status --json`                                      | Confirm token presence, expiry, refresh-token availability, stored user. |
| Identity          | `mxs auth whoami --json`                                      | Confirm authenticated user and resolved API URL.                         |
| Content context   | `mxs category list --json`                                    | Confirm category/tag availability for posts.                             |
| Note context      | `mxs topic list --json`                                       | Confirm topic availability for notes.                                    |

Local development normally uses `http://localhost:2333` as the origin. Do not add `/api/v3` to `MXS_API_URL` or `--api-url`; the CLI derives API and auth bases.

## Authentication inputs

| Input                        | Meaning                                                | Use case                                  |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `mxs auth login`             | Device authorization flow.                             | Interactive credential setup.             |
| `MXS_TOKEN` or `--token`     | Better Auth access token as bearer auth.               | Session/OIDC token override.              |
| `MXS_API_KEY` or `--api-key` | API key sent as `x-api-key`.                           | Server API key workflows.                 |
| stored credentials           | `~/.config/mxs/credentials.json` by default.           | Normal CLI state after login.             |

If reads work but writes return `auth.expired`, verify whether the credential is an API key incorrectly supplied as a bearer token. API keys must use `MXS_API_KEY` or `--api-key`.

Credential renewal has two paths. If a stored OAuth `refresh_token` exists, the CLI uses a refresh-token grant. Device authorization normally stores a Better Auth session token; that path renews by calling Better Auth `/get-session`, accepting the refreshed `set-auth-token` header, and updating the stored session expiry.

## Configuration files

| File                                  | Mode   | Purpose                                                  |
| ------------------------------------- | ------ | -------------------------------------------------------- |
| `~/.config/mxs/profiles/<name>/config.json`      | `0644` | API URL, API base, auth base, API version, client id. |
| `~/.config/mxs/profiles/<name>/credentials.json` | `0600` | Access token, refresh token, expiry, optional user.   |
| `~/.config/mxs/current`               | `0644` | Single line — the name of the active profile.            |

`XDG_CONFIG_HOME` changes the base directory. Credential files with wider permissions are automatically changed to `0600`.

Example profile config:

```json
{
  "api_url": "https://blog.example.com",
  "api_base": "https://blog.example.com/api/v3",
  "auth_base": "https://blog.example.com/api/v3/auth",
  "api_version": 3,
  "client_id": "mxs-cli"
}
```

## Environment variables

| Variable           | Meaning                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `MXS_API_URL`      | API origin override.                                                   |
| `MXS_TOKEN`        | Better Auth access token override; sent as `Authorization: Bearer`.    |
| `MXS_API_KEY`      | API key override; sent as `x-api-key`.                                 |
| `MXS_PROFILE`      | Profile name to use; equivalent to `--profile`.                        |
| `MXS_DEBUG=1`      | Enables verbose HTTP diagnostics in auth helpers.                      |
| `EDITOR`           | Editor for `post edit`, `note edit`, `page edit`, `config edit`.       |
| `XDG_CONFIG_HOME`  | Base directory for `mxs` config files.                                 |

See `output-modes` for `--json`, `--output`, and the rest of the global flag table.
