# Auth, Config, And Output

Use this reference before target-sensitive operations or whenever output shape matters.

## Target Confirmation

| Step | Command | Purpose |
| --- | --- | --- |
| Auth state | `mxs auth status --json` | Confirm token presence, expiry, refresh-token availability, and stored user. |
| Identity | `mxs auth whoami --json` | Confirm authenticated user and resolved API URL. |
| Content context | `mxs category list --json` | Confirm category/tag availability for posts. |
| Note context | `mxs topic list --json` | Confirm topic availability for notes. |

`auth status` reads local CLI state. `auth whoami` validates bearer credentials against the configured server when a session token is available, then falls back to cached identity only when the server returns no session. It still does not prove write authorization; a target may allow authenticated identity reads while returning `auth.expired` or `auth.denied` for mutations. Treat the first real mutation, or a server-validated write-permission probe, as the authoritative write-auth check.

Local development normally uses `http://localhost:2333` as the origin. Do not add `/api/v2` to `MXS_API_URL` or `--api-url`; the CLI derives API and auth bases.

## Authentication Inputs

| Input | Meaning | Use Case |
| --- | --- | --- |
| `mxs auth login` | Device authorization flow. | Interactive credential setup. |
| `MXS_TOKEN` or `--token` | Better Auth access token as bearer auth. | Session/OIDC token override. |
| `MXS_API_KEY` or `--api-key` | API key sent as `x-api-key`. | Server API key workflows. |
| stored credentials | `~/.config/mxs/credentials.json` by default. | Normal CLI state after login. |

If reads work but writes return `auth.expired`, verify whether the credential is an API key incorrectly supplied as a bearer token. API keys must use `MXS_API_KEY` or `--api-key`.

Credential renewal has two paths. If a stored OAuth `refresh_token` exists, the CLI uses a refresh-token grant. Device authorization normally stores a Better Auth session token; that path renews by calling Better Auth `/get-session`, accepting the refreshed `set-auth-token` header, and updating the stored session expiry.

## Configuration Files

| File | Mode | Purpose |
| --- | --- | --- |
| `~/.config/mxs/config.json` | `0644` | API URL, API base, auth base, API version, and client id. |
| `~/.config/mxs/credentials.json` | `0600` | Access token, refresh token, expiry, and optional user profile. |

`XDG_CONFIG_HOME` changes the base directory. Credential files with wider permissions are automatically changed to `0600`.

Example config:

```json
{
  "api_url": "https://blog.example.com",
  "api_base": "https://blog.example.com/api/v2",
  "auth_base": "https://blog.example.com/api/v2/auth",
  "api_version": 2,
  "client_id": "mxs-cli"
}
```

## Environment Variables

| Variable | Meaning |
| --- | --- |
| `MXS_API_URL` | API origin override. |
| `MXS_TOKEN` | Better Auth access token override; sent as `Authorization: Bearer`. |
| `MXS_API_KEY` | API key override; sent as `x-api-key`. |
| `MXS_DEBUG=1` | Enables verbose HTTP diagnostics in auth helpers. |
| `EDITOR` | Editor for `post edit`, `note edit`, `page edit`, and `config edit`. |
| `XDG_CONFIG_HOME` | Base directory for `mxs` config files. |

## Output Modes

| Mode | Shape | Primary Use |
| --- | --- | --- |
| `pretty-json` | Raw response payload formatted with indentation. | Human inspection and existing behavior. |
| `json` | `{ ok: true, data }` JSON envelope. | Scripts and structured automation. |
| `readable` | Compact metadata plus readable body. | Human terminal reading. |
| `llm` | Stable readable structure optimized for agent context. | Low-noise document read-back. |
| `envelope` | `<mxpost>` or `<mxnote>` LiteXML envelope. | Editable document round trips. |

`--json` takes precedence over `--output`.

## Output Selection Rules

| Operation | Preferred Output |
| --- | --- |
| Mutation | `--json` |
| Strict scripted read | `--json` |
| Document body verification | `--output llm` |
| Editable round trip | `--output envelope` |
| Human terminal review | `--output readable` |

For Lexical documents, `readable`, `llm`, and `envelope` render the body through LiteXML instead of exposing raw Lexical JSON.
