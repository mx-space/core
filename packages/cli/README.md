# @mx-space/cli (`mxs`)

A single-user command-line interface for managing a deployed [mx-core](https://github.com/mx-space/core) blog. Designed for self-hosting blog owners and AI agents acting on their behalf.

## Install

```bash
# pnpm
pnpm add -g @mx-space/cli

# npm
npm install -g @mx-space/cli
```

Requires Node.js 22 or newer.

## Quick start

```bash
# 1. authenticate (opens browser, OIDC device flow)
mxs auth login

# 2. create a post from a LiteXML envelope
mxs post create --file ./post.xml

# 3. update fields without touching content
mxs post update my-slug --title "new title" --state publish
```

When the CLI cannot find an API URL it enters an inline onboarding prompt (TTY only). Set `MXS_API_URL` or pass `--api-url` to skip the prompt.

## AI usage

Every command supports `--json` for structured output. Combine with `--file` for atomic LiteXML envelopes.

```bash
mxs post create --file ./post.xml --json
```

Success response:

```json
{ "ok": true, "data": { /* server post */ } }
```

Error response (exit codes per the table below):

```json
{
  "ok": false,
  "code": "validation.failed",
  "message": "...",
  "details": { "issues": [ /* … */ ] },
  "hint": "run `mxs category list`"
}
```

## LiteXML envelopes

A single XML file may carry both meta and Lexical content. Outer root must be `<mxpost>` or `<mxnote>`. The `<content>` body is parsed by `@haklex/rich-litexml`.

```xml
<mxpost>
  <meta>
    <title>题名</title>
    <slug>my-post</slug>
    <category>tech</category>
    <tags><tag>foo</tag><tag>bar</tag></tags>
    <state>publish</state>
    <summary>摘要</summary>
    <copyright>true</copyright>
    <pin>2026-05-14</pin>
  </meta>
  <content>
    <p>正文……</p>
    <h2>章节</h2>
  </content>
</mxpost>
```

### `--content` spec grammar

- `--content="inline literal"` — inline string
- `--content=file=<path>` — read from filesystem
- `--content=-` or `--content=stdin` — read from stdin

Flag values override envelope `<meta>` values.

## Field flags

### Post

| Flag | Field | Notes |
| --- | --- | --- |
| `--title <s>` | `title` | required (create) |
| `--slug <s>` | `slug` | required (create) |
| `--category <s>` | `categoryId` | resolved by id / slug / name |
| `--content <spec>` | `content` | LiteXML when `--format=lexical` |
| `--format <s>` | `contentFormat` | `lexical` (default) or `markdown` |
| `--summary <s>` | `summary` | |
| `--state <s>` | `isPublished` | `publish` or `draft` |
| `--tags <csv>` | `tags` | comma-separated |
| `--copyright <b>` | `copyright` | `true` or `false` |
| `--pin <iso>` | `pin` | ISO date |
| `--pin-order <n>` | `pinOrder` | integer ≥ 0 |
| `--related <csv>` | `relatedId` | comma-separated ids |
| `--meta <spec>` | `meta` | JSON literal or `file=<path>` |
| `--file <path>` | — | single LiteXML envelope |

### Note

| Flag | Field |
| --- | --- |
| `--title <s>` | `title` (default `无题`) |
| `--slug <s>` | `slug` |
| `--topic <s>` | `topicId` (resolved by id / slug / name) |
| `--content <spec>` | `content` |
| `--format <s>` | `contentFormat` |
| `--state <s>` | `isPublished` |
| `--mood <s>` | `mood` |
| `--weather <s>` | `weather` |
| `--public-at <iso>` | `publicAt` |
| `--password <s>` | `password` |
| `--bookmark <b>` | `bookmark` |
| `--coords <lat,lng>` | `coordinates` |
| `--location <s>` | `location` |
| `--images <spec>` | `images` (JSON literal / `file=<path>`) |
| `--meta <spec>` | `meta` |
| `--file <path>` | LiteXML envelope (`<mxnote>`) |

### Page / Category / Topic

See `mxs page --help`, `mxs category --help`, `mxs topic --help`.

## Cross-cutting flags

| Flag | Effect |
| --- | --- |
| `--json` | emit JSON envelope on stdout |
| `--api-url <url>` | override `config.json` `api_url` |
| `--token <t>` | override stored access token |
| `--quiet` / `-q` | suppress non-error stderr |
| `--verbose` | log HTTP method/url/status/duration |
| `--dry-run` | show resolved payload, do not call server |

## Environment variables

| Env | Meaning |
| --- | --- |
| `MXS_API_URL` | API base URL |
| `MXS_TOKEN` | Access token override |
| `MXS_DEBUG=1` | Verbose with redacted headers |
| `EDITOR` | Editor used for `mxs post edit` round-trip |
| `XDG_CONFIG_HOME` | Overrides config directory (default `~/.config`) |

## Config files

`~/.config/mxs/config.json` (mode 0644):

```json
{
  "api_url": "https://blog.example.com",
  "api_base": "https://blog.example.com/api/v2",
  "auth_base": "https://blog.example.com/api/v2/auth",
  "api_version": 2,
  "client_id": "mxs-cli"
}
```

`~/.config/mxs/credentials.json` (mode 0600):

```json
{
  "access_token": "…",
  "refresh_token": "…",
  "expires_at": 1715670000000,
  "user": { "id": "…", "email": "…", "name": "…" }
}
```

The CLI enforces mode 0600 on the credentials file (warns and `chmod` if wider).

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Generic |
| 2 | Argv parse |
| 3 | Auth (401 / 403 / no token / expired refresh) |
| 4 | Network |
| 5 | Validation / config missing |
| 6 | Server 5xx |
| 7 | Resource not found (404) |

## Troubleshooting

### "cannot detect auth endpoint" (`auth.probe`)

Verify the URL points at a live mx-core server with the `deviceAuthorization` plugin enabled. The CLI probes `/api/v2/auth/ok` then `/auth/ok`. Use `--verbose` to see HTTP requests.

### Bearer header narrowing (breaking change)

mx-core's `Authorization: Bearer <token>` header is now exclusively for Better Auth session/OIDC access tokens. External clients that previously authenticated with `Authorization: Bearer <api-key>` must switch to `x-api-key: <api-key>`. Affects webhooks and any script-side custom clients.

### `EDITOR is not set`

Set `EDITOR=vim` (or your preferred editor) before running `mxs post edit`.

## License

AGPL-3.0
