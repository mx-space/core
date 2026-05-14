# mx-core CLI (`@mx-space/cli`, binary `mxs`) — Design

- Status: Draft (awaiting approval)
- Author: Innei
- Date: 2026-05-14
- Scope: v1 — auth, content (post / note / page / category / topic), config. v2 (AI) and v3 (maintenance / backup / export-import) are listed in roadmap only.

## 1. Goals & Non-Goals

### Goals (v1)

- Ship a single-user, self-host-oriented CLI that lets the site owner — or an AI agent acting on their behalf — manage a deployed mx-core instance from anywhere.
- Authenticate via OIDC Device Authorization Grant (RFC 8628) against the mx-core server's Better Auth.
- Provide first-class authoring ergonomics centred on Lexical content, using `@haklex/rich-litexml` as the editing format so humans and AI agents both author in LiteXML XML instead of raw Lexical JSON.
- Cover three command domains in v1: auth (device login / logout / whoami / status), content (post / note / page / category / topic), configuration (option).
- Be scriptable: every field exposed as a flag, every output renderable as `--json`, exit codes meaningful.

### Non-Goals (v1)

- Multi-instance profiles (`mxs use <site>`) — single API URL only, deferred to v3.
- AI commands (`mxs ai summary regen`, translation, insights) — deferred to v2 roadmap.
- Comment moderation (`mxs comment ...`) — v2.
- Maintenance (cache / search / data-jobs / health) — v3.
- Backup (dump / restore / download) — v3.
- Export / import of content as files — v3.
- Observability (`mxs logs tail`, `mxs metrics`) — v3.
- Markdown → Lexical conversion. Markdown posts stay markdown; LiteXML round-trip only applies when the server's `contentFormat = lexical`.
- OS keychain integration; v1 stores credentials in `~/.config/mxs/credentials.json` (mode 0600) with env override.

## 2. Decisions Summary

| Topic | Decision |
| --- | --- |
| Distribution | npm `@mx-space/cli`, binary `mxs`, monorepo location `packages/cli/` |
| Tech | Node 22, TypeScript, `commander` for argv, `tsdown` for build |
| Auth | Better Auth `device-authorization` plugin (server) + `deviceAuthorizationClient` (CLI), OIDC device flow |
| API client | Reuse `@mx-space/api-client` (workspace dep) |
| Editor format | `@haklex/rich-litexml` (workspace dep), default LiteXML; `--format=markdown` parallel channel |
| Command surface | noun-verb (`mxs post list`, gh / wrangler style) |
| Config storage | `~/.config/mxs/config.json` + `~/.config/mxs/credentials.json` (mode 0600). Env vars `MXS_API_URL` / `MXS_TOKEN` override. |
| API prefix | Respect server's `API_VERSION` (currently `2`). Prod prefix `/api/v2/`, dev no prefix. CLI auto-probes at `auth login` and persists to `config.json`. |
| Bearer header | apiKey plugin's `customAPIKeyGetter` will be narrowed to **only** read `x-api-key`. `Authorization: Bearer <token>` becomes exclusive to Better Auth session/OIDC access tokens. Breaking change — see §10. |
| Device verification page | New core controller, rendered server-side via EJS (already a project dependency). No admin-vue3 dependency. |

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  @mx-space/cli (packages/cli/)                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  bin/mxs.ts — commander entry                    │    │
│  └──────┬───────────────────────────────────────────┘    │
│         │                                                │
│  commands/                                               │
│    auth/{login,logout,whoami,status}.ts                  │
│    post/{list,get,create,edit,update,delete,publish}.ts  │
│    note/{list,get,create,edit,update,delete,publish}.ts  │
│    page/{list,get,create,edit,update,delete}.ts          │
│    category/{list,get,create,update,delete}.ts           │
│    topic/{list,get,create,update,delete}.ts              │
│    config/{list,get,set,edit}.ts                         │
│         │                                                │
│  core/                                                   │
│    api-client.ts     — wraps @mx-space/api-client        │
│    auth.ts           — device flow, token refresh        │
│    config-store.ts   — fs r/w ~/.config/mxs/             │
│    envelope.ts       — <mxpost>/<mxnote> XML envelope    │
│    litexml-codec.ts  — wraps @haklex/rich-litexml        │
│    editor.ts         — $EDITOR round-trip                │
│    output.ts         — human / JSON renderer             │
│    errors.ts         — MxsError, exit-code mapping       │
│    resolve.ts        — category/topic name → id          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼ HTTPS
                  ┌────────────────────┐
                  │  mx-core server    │
                  │  + deviceAuth      │
                  │    plugin (new)    │
                  │  + DeviceController│
                  │    (EJS, new)      │
                  └────────────────────┘
```

**Boundaries.** Commands depend only on `core/`. `core/` modules do not import from `commands/`. Each command file owns a single action and stays under 300 lines (per project rule).

## 4. v1 Commands

### 4.1 Cross-cutting flags

Applicable to every command unless noted.

| Flag | Effect |
| --- | --- |
| `--json` | Structured output on stdout. Errors emit JSON envelope (§7). |
| `--api-url <url>` | Override `config.json` `api_url`. |
| `--token <t>` | Override stored access token. |
| `--quiet`, `-q` | Suppress non-error stderr. |
| `--verbose` | Log HTTP method/url/status/duration to stderr. Auth headers redacted. |
| `--dry-run` | Show resolved payload, do not call server. |
| `--help`, `-h` | Help. |

Environment variables: `MXS_API_URL`, `MXS_TOKEN`, `MXS_DEBUG=1`.

Resolution precedence: flag > env > `~/.config/mxs/` > prompt / error.

### 4.2 Auth

```
mxs auth login          # device flow, opens browser
mxs auth logout         # delete credentials.json, keep config.json
mxs auth whoami         # show user + api_url
mxs auth status         # token validity, expiry, refresh-token presence
```

### 4.3 Content

#### Post

```
mxs post list [--page N] [--size N] [--state=draft|publish] [--sort=created|modified]
mxs post get <slug-or-id>
mxs post create   [field flags…]   [--file <path>]
mxs post edit  <slug-or-id> [field flags…] [--file <path>]   # full replace
mxs post update <slug-or-id> [field flags…]                  # partial PATCH, content untouched unless --content given
mxs post delete <slug-or-id> [--force]
mxs post publish <slug-or-id>
mxs post unpublish <slug-or-id>
```

#### Note / Page

Identical verb set: `list / get / create / edit / update / delete`. Note adds `publish/unpublish`.

#### Category

```
mxs category list [--json]
mxs category get <slug-or-id>
mxs category create --name N --slug S [--type=category|tag] [--icon ...]
mxs category update <slug-or-id> [field flags]
mxs category delete <slug-or-id> [--force]
```

#### Topic

```
mxs topic list [--json]
mxs topic get <slug-or-id>
mxs topic create --name N --slug S [--description D] [--icon ...]
mxs topic update <slug-or-id> [field flags]
mxs topic delete <slug-or-id> [--force]
```

### 4.4 Field flags (write surface)

#### Post fields

| Schema field | Flag | Notes |
| --- | --- | --- |
| `title` (required) | `--title <s>` | non-empty |
| `slug` (required) | `--slug <s>` | non-empty |
| `categoryId` (required) | `--category <name\|slug\|id>` | resolved via §6 |
| `content` | `--content=<spec>` | inline / `file=<path>` / `-` (stdin). When `--format=lexical`, parsed as LiteXML; when `--format=markdown`, raw markdown. |
| `contentFormat` | `--format=lexical\|markdown` | default `lexical` for new content authored via CLI. When editing an existing post, CLI respects whatever the server returned (markdown stays markdown). |
| `text` | (derived) | Always derived from `content`. Never user-set. |
| `summary` | `--summary <s>` | |
| `isPublished` | `--state=publish\|draft` | |
| `tags` | `--tags a,b,c` | comma-split |
| `copyright` | `--copyright true\|false` | default true |
| `pin` | `--pin <iso-date>` | |
| `pinOrder` | `--pin-order <n>` | int ≥ 0 |
| `relatedId` | `--related id1,id2` | comma-split |
| `meta` | `--meta=file=<path>` | JSON object |

#### Note fields

| Schema field | Flag | Notes |
| --- | --- | --- |
| `title` | `--title <s>` | default "无题" |
| `slug` | `--slug <s>` | optional, trimmed |
| `text` | (derived from `--content`) | |
| `content` | `--content=<spec>` | same as post |
| `contentFormat` | `--format=lexical\|markdown` | |
| `topicId` | `--topic <name\|slug\|id>` | resolved |
| `isPublished` | `--state=publish\|draft` | |
| `mood` | `--mood <s>` | |
| `weather` | `--weather <s>` | |
| `publicAt` | `--public-at <iso>` | |
| `password` | `--password <s>` | |
| `bookmark` | `--bookmark true\|false` | |
| `coordinates` | `--coords <lat,lng>` | parsed `lat,lng` floats |
| `location` | `--location <s>` | |
| `images` | `--images=file=<path>` | JSON array |
| `meta` | `--meta=file=<path>` | JSON object |

`--content` spec grammar:
- `--content="inline literal"` — inline text
- `--content=file=<path>` — read from filesystem
- `--content=-` or `--content=stdin` — read from stdin

#### Single-file `.xml` envelope

For atomic AI-driven workflows, a single `.xml` may carry both meta and content. Used via `--file <path>`.

`post.xml`:

```xml
<mxpost>
  <meta>
    <title>题名</title>
    <slug>my-post</slug>
    <category>tech</category>          <!-- name | slug | id -->
    <tags>
      <tag>foo</tag>
      <tag>bar</tag>
    </tags>
    <state>publish</state>             <!-- publish | draft -->
    <summary>摘要</summary>
    <copyright>true</copyright>
    <pin>2026-05-14</pin>
  </meta>
  <content>
    <!-- LiteXML body, parsed by @haklex/rich-litexml -->
    <p>正文……</p>
    <h2>章节</h2>
    <code lang="ts">...</code>
  </content>
</mxpost>
```

`note.xml`:

```xml
<mxnote>
  <meta>
    <title>题名</title>
    <slug>my-note</slug>
    <topic>life</topic>
    <state>publish</state>
    <mood>happy</mood>
    <weather>sunny</weather>
    <publicAt>2026-05-14T10:00:00Z</publicAt>
    <password>secret</password>
    <bookmark>false</bookmark>
  </meta>
  <content>
    <p>正文……</p>
  </content>
</mxnote>
```

**Envelope rules**

- Outer root must be `<mxpost>` or `<mxnote>` (matches the command resource).
- `<meta>` children are mapped 1:1 to field flag names (kebab-cased flag → camelCase tag, e.g. `--pin-order` → `<pinOrder>`).
- Children parsed as text content, except `<tags><tag>...</tag></tags>` arrays.
- `<content>` body is passed verbatim to `@haklex/rich-litexml` deserializer.
- Unknown `<meta>` children cause a warning, not an error.
- Flag overrides envelope: `--state=draft --file post.xml` sets state to draft regardless of `<state>publish</state>`.

### 4.5 Config

```
mxs config list                       # list all option keys + types
mxs config get <key>                  # read one
mxs config set <key> <value> [--type=json|string|number|bool]
mxs config edit                       # pull full options as YAML, $EDITOR, diff + push
```

## 5. Content Conversion Flow

### 5.1 Write (`create` / `edit` with `--file` or `--content`)

```
input (--file=*.xml | --content=spec | argv)
   │
   ├─ envelope parser (commands consuming --file)
   │     └─ extract <meta> → field flags layer
   │     └─ extract <content> → LiteXML inner string
   │
   ▼
LiteXML inner string
   │
   ▼  @haklex/rich-litexml::deserialize
   │
SerializedEditorState (Lexical JSON)
   │
   ├─ JSON.stringify         → payload.content
   ├─ renderMarkdown(state)  → payload.text   (plaintext-ish, used by search/SEO)
   └─ contentFormat = 'lexical'
   │
   ▼
field flags overlay (flags > envelope > defaults)
   │
   ▼
local zod pre-validation (mirrors server schema)
   │
   ▼  api-client.<resource>.<create|update>
   │
   ├─ 2xx → render result via output.ts
   └─ 4xx/5xx → MxsError with mapped issues (§7)
```

### 5.2 Read (`edit` with no `--file`)

```
GET resource
   │
   ▼
if contentFormat === 'lexical':
   JSON.parse(content)
       │
       ▼  @haklex/rich-litexml::serialize
       │
   LiteXML inner string

if contentFormat === 'markdown':
   markdown stays markdown. Editor is opened in markdown mode (no LiteXML round-trip).
   On save, server is updated with contentFormat=markdown unchanged.
   To upgrade, user explicitly passes --format=lexical (re-authors content).
   │
   ▼
wrap in <mxpost>/<mxnote> envelope with current meta values
   │
   ▼
write tmp file → spawn $EDITOR → wait
   │
   ▼
re-read tmp file → write path (§5.1)
```

`--format=markdown` selects parallel markdown channel end-to-end: edit reads markdown, opens markdown buffer, posts markdown. No conversion.

### 5.3 `text` field derivation

`text` is never user-supplied via CLI. Derivation:

- `contentFormat=lexical`: `text = renderMarkdown(state)`. This produces markdown; mx-core's search currently treats `text` as full-text source, which is acceptable as markdown.
- `contentFormat=markdown`: `text = content` (identity).
- Empty content (`--content=""` or empty `<content/>`): `text = ""`. Server's zod allows `text: z.string()` (empty allowed); `content` is optional when `contentFormat=markdown`, required and non-empty when `contentFormat=lexical` (per `WriteBaseSchemaWithRefine`). CLI mirrors this refine locally.

### 5.4 Unsupported nodes

If LiteXML body contains a node the haklex deserializer rejects (e.g. embed types not registered), CLI emits a parse error with line number and node name. `--strict=false` (future) could preserve unknown nodes as raw blocks; v1 errors out.

If Lexical → LiteXML serialization encounters a node without a writer (custom embeds), CLI logs a warning and emits a placeholder element; the underlying Lexical JSON is preserved when round-tripping `edit` (we store the original JSON for diff and prefer it if the user did not touch content).

## 6. Name Resolution (category / topic)

`mxs post create --category tech` needs to send `categoryId`. Strategy:

1. If value matches `/^\d{15,}$/` (snowflake), assume id; verify via GET.
2. Otherwise, fetch `GET /categories` (cached 60s in-memory per CLI invocation), then match in order: `slug === value` → `name === value` → case-insensitive name.
3. On miss, emit error with fuzzy suggestions (Levenshtein ≤ 2 over name+slug).
4. Topic resolution: same algorithm against `/topics`.

This is local to `core/resolve.ts`. No server changes required.

## 7. Errors & Output

### 7.1 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Generic |
| 2 | Argv parse (commander) |
| 3 | Auth (401 / 403 / no token / expired refresh) |
| 4 | Network (timeout / DNS / connection refused) |
| 5 | Validation (zod / required missing / XML parse) |
| 6 | Server 5xx |
| 7 | Resource not found (404) |

### 7.2 Human output

```
✘ Validation failed
  · meta.title: required
  · meta.category: "tech" not found (did you mean "技术"?)
  · content: line 14: unknown node <foo>

hint: run `mxs category list` to see available categories
```

### 7.3 JSON output (`--json`)

When `--json` is passed, stdout emits a single JSON object. AI agents are expected to always pass `--json`. The CLI does **not** auto-switch on TTY detection — explicit flag only, to keep output deterministic.

```json
{
  "ok": false,
  "code": "validation.failed",
  "message": "Validation failed",
  "details": {
    "issues": [
      {"path": ["meta", "title"], "message": "required"},
      {"path": ["meta", "category"], "message": "not found", "suggestions": ["技术"]},
      {"path": ["content"], "line": 14, "message": "unknown node <foo>"}
    ]
  },
  "hint": "run `mxs category list`"
}
```

Success envelope:

```json
{
  "ok": true,
  "data": { ... }
}
```

### 7.4 Logging policy

- stdout: command result only (so output is pipeable).
- stderr: human messages, progress, warnings, errors.
- `--quiet` suppresses non-error stderr.
- `--verbose` adds per-request `METHOD URL → STATUS (Nms)`.
- `MXS_DEBUG=1` adds headers (Authorization redacted).
- Access / refresh tokens never logged.

## 8. Authentication

### 8.1 Server-side changes (`apps/core`)

#### 8.1.1 Better Auth plugin

`apps/core/src/modules/auth/auth.implement.ts` — add `deviceAuthorization`:

```ts
import { deviceAuthorization } from 'better-auth/plugins'

plugins: [
  apiKey({
    /* updated, see §10 */
    apiKeyHeaders: ['x-api-key'],
    customAPIKeyGetter: (ctx) => ctx.headers?.get('x-api-key') ?? null,
  }),
  passkey({ ... }),
  username({ ... }),
  deviceAuthorization({
    expiresIn: '30m',
    interval: '5s',
    userCode: { length: 8, charset: 'A-Z0-9' },
    verificationUri: ({ request }) => {
      // built from request origin + ApiController prefix
      const origin = new URL(request.url).origin
      const prefix = isDev ? '' : `/api/v${API_VERSION}`
      return `${origin}${prefix}/device`
    },
    onDeviceAuthRequest: async (clientId) => {
      if (clientId !== 'mxs-cli') {
        throw new APIError('invalid_client')
      }
    },
  }),
]
```

`clientId` is fixed to `"mxs-cli"`; no dynamic client registration in v1.

#### 8.1.2 Device verification page controller

New file `apps/core/src/modules/auth/device.controller.ts` rendered with EJS (already used in `pageproxy.controller.ts` and email templates — `ejs@^3.1.x` already a project dependency).

```ts
@ApiController('device')
export class DeviceController {
  @Get()
  async page(@Query('user_code') userCode = '', @Res() res, @CurrentUser() user) {
    if (!user) return res.redirect('/admin/#/login?redirect=' + encodeURIComponent(req.url))
    const template = await this.asset.getAsset(
      '/render/device.ejs',
      { fallback: INLINE_DEVICE_TEMPLATE }
    )
    res.type('html').send(ejs.render(template, { userCode, user, siteTitle }))
  }

  @Post('verify')
  async verify(@Body() body: { user_code: string; action: 'approve' | 'deny' }, @CurrentUser() user) {
    // delegate to better-auth's deviceAuthorization plugin verify endpoint
    return this.authService.verifyDeviceCode(user, body.user_code, body.action)
  }
}
```

Template: `apps/core/assets/templates/device.ejs` (with an inline string constant fallback for first boot). The page shows:

- The pre-filled or input user code.
- Approve / Deny buttons.
- Confirmation on success, error otherwise.

The route resolves to:

- prod: `/api/v2/device`
- dev: `/device`

#### 8.1.3 Better Auth `basePath` already correct

`auth.implement.ts:40` already does `isDev ? '/auth' : `/api/v${API_VERSION}/auth``. Device flow endpoints (`/device/code`, `/device/token`, plugin-provided) inherit this base.

### 8.2 CLI-side flow

```
$ mxs auth login
? API URL: https://blog.example.com
🔍 probing server… API v2 (prefix /api/v2)
🔐 requesting device code…
📱 visit: https://blog.example.com/api/v2/device?user_code=ABCD-EFGH
   code: ABCD-EFGH
⏳ waiting… (poll 5s)
✅ authorized as innei <innei@example.com>
🗝  token saved to ~/.config/mxs/credentials.json
```

CLI uses `better-auth/client` + `deviceAuthorizationClient()`:

```ts
const client = createAuthClient({
  baseURL: cfg.api_base,           // e.g. https://blog/api/v2
  basePath: '/auth',               // appended to baseURL → /api/v2/auth
  plugins: [deviceAuthorizationClient()],
})
const { data } = await client.device.code({ client_id: 'mxs-cli', scope: 'openid profile email' })
// poll client.device.token(...) until access_token returned
```

### 8.3 Prefix detection

User enters bare URL (`https://blog.example.com`). CLI probes auth endpoints:

```ts
const candidates = [`/api/v${API_VERSION}/auth`, '/auth']
for (const path of candidates) {
  const res = await fetch(`${apiUrl}${path}/ok`).catch(() => null)
  if (res?.ok) {
    config.api_version = API_VERSION
    config.auth_base = `${apiUrl}${path}`
    config.api_base = path === '/auth' ? apiUrl : `${apiUrl}/api/v${API_VERSION}`
    return
  }
}
throw new MxsError('auth.probe', 'cannot detect auth endpoint')
```

Probing runs once at `auth login` and the result is persisted in `config.json`. The CLI ships a constant `SUPPORTED_API_VERSIONS = [2]` (a descending list of versions it can talk to; updated on CLI bumps). Probe order: each supported version's prefix first, then `/auth` (dev). If a future server advertises a higher API version not in the list, the CLI exits with a clear "please upgrade `@mx-space/cli`" message.

### 8.4 Token storage

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

`~/.config/mxs/credentials.json` (mode **0600**):

```json
{
  "access_token": "…",
  "refresh_token": "…",
  "expires_at": 1715670000000,
  "user": { "id": "…", "email": "…", "name": "…" }
}
```

On start, CLI stats credentials.json; if mode is wider than 0600 it warns and `chmod 600`s.

### 8.5 Refresh & failure

- Before each HTTP call: if `expires_at < now + 60_000`, call refresh endpoint.
- On 401: refresh once, retry once. Still 401 → exit code 3, hint `mxs auth login`.
- `mxs auth logout` deletes credentials.json; keeps config.json.

### 8.6 Security

- Credentials file enforced 0600.
- `--token` flag is visible in `ps`; emit warning suggesting `MXS_TOKEN`.
- Tokens never written to stdout/stderr/logs.
- OS keychain support deferred to v2.

## 9. Breaking Change: apiKey Bearer Path

Current `auth.implement.ts:103-114` accepts API keys via both `x-api-key` header **and** `Authorization: Bearer <key>`. This collides with OIDC device-flow access tokens which also use Bearer.

**Resolution:** narrow `customAPIKeyGetter` to read only `x-api-key`. `Authorization: Bearer <token>` becomes exclusively a Better Auth session/OIDC token.

**Migration impact:** external clients (webhooks, scripts) that currently authenticate via `Authorization: Bearer <api-key>` must switch to `x-api-key: <api-key>`. To be called out in:

- mx-core release notes (with the CLI release).
- `apps/core/readme.md` API auth section.
- `packages/api-client/readme.md` if it documents Bearer auth.

A grep over the repo at implementation time should confirm whether existing internal code paths rely on Bearer for API keys.

## 10. Testing

### 10.1 Unit (vitest, in `packages/cli`)

- `core/litexml-codec.test.ts`: fixture `.xml` → expected Lexical JSON; reverse.
- `core/envelope.test.ts`: `<mxpost>` / `<mxnote>` meta mapping + line-number traceback.
- `core/config-store.test.ts`: 0600 permission enforcement, env override precedence.
- `core/auth.test.ts`: token refresh, expiry detection, file r/w (mock fs).
- `core/resolve.test.ts`: category/topic name resolution + fuzzy suggestions.
- `commands/post/create.test.ts`: flags + envelope → payload (covers `--content=file=`, `--content=-`, `--content="inline"`).

Coverage target: `core/` ≥ 90%, `commands/` ≥ 80% (each command's `--dry-run` path tested).

### 10.2 Integration (mock server in CLI tests)

- Fastify mock simulates mx-core REST + Better Auth device endpoints.
- Full `mxs <cmd>` round-trip via spawning the bin against the mock.

### 10.3 Server-side e2e (in `apps/core/test`)

- `auth-device.e2e-spec.ts`: device code → user verification → token issuance.
- `device-controller.e2e-spec.ts`: EJS page renders, redirects unauthenticated to admin login.
- `auth-bearer-narrowing.e2e-spec.ts`: confirms `Authorization: Bearer <api-key>` no longer authenticates after change.
- Uses `createE2EApp` + `startPgTestContainer` per existing helpers.

### 10.4 Manual smoke (release gate)

Documented in `packages/cli/test/manual.md`:

1. `mxs auth login` against a real mx-core dev instance.
2. `mxs post create --file fixtures/post.xml` → server receives correct payload.
3. `mxs post edit <id>` → tmp file round-trips identically (Lexical → LiteXML → Lexical idempotent).
4. `mxs post create --format=markdown --content=file=fixtures/body.md`.
5. `mxs category list` after creating categories.

## 11. Distribution & CI

- `packages/cli/package.json` declares `"bin": { "mxs": "./dist/bin/mxs.mjs" }`, `"publishConfig": { "access": "public" }`.
- Build: `tsdown` produces ESM bundle with shebang.
- CI workflow `.github/workflows/cli.yml`:
  - Node 22 matrix.
  - `pnpm -C packages/cli build && pnpm -C packages/cli test`.
  - On tag matching `cli-v*`, run `pnpm publish --filter @mx-space/cli --access public`.

## 12. Documentation

- `packages/cli/README.md`: install, quick start (login + create post), AI usage example (`mxs post create --file post.xml --json`), full field/flag table linking back to this spec, troubleshooting (auth probe failure, Bearer narrowing migration).
- `packages/cli/ROADMAP.md`: v2 items (see §13).
- `docs/CODEMAPS/cli.md` (if codemap discipline applies): generated map of `packages/cli/src/`.
- Update `apps/core/readme.md` with new auth header rule (§10).

## 13. Roadmap (declared, not built)

To be captured in `packages/cli/ROADMAP.md`.

### v2

- **AI module commands**: `mxs ai summary regen <id>`, `mxs ai translate <id> --to ja`, `mxs ai insights refresh`, `mxs ai tokens`. Depends on existing `apps/core/src/modules/ai`.
- **Comment moderation**: `mxs comment list / approve / reject / delete`.
- **Markdown ↔ Lexical bridge**: contingent on haklex adding markdown → Lexical reader.

### v3

- **Maintenance**:
  - `mxs cache clear [--scope=all|view|post|note|page|aggregate]`, `mxs cache stats`
  - `mxs search reindex`, `mxs search status`
  - `mxs job list`, `mxs job run <name>` (data-jobs from `apps/core/src/maintenance/jobs`)
  - `mxs health`
- **Backup**:
  - `mxs backup create [--output <path>]`
  - `mxs backup list`
  - `mxs backup download <id> [--output <path>]`
  - `mxs backup restore <id-or-file> [--force]`
- **Export / import (content)**:
  - `mxs export <dir> [--type=post,note,page] [--format=markdown|litexml]`
  - `mxs import <dir> [--type=post] [--update-existing]`
- **Multi-profile**: `mxs use <name>`, `~/.config/mxs/profiles.json`, profile-scoped credentials.
- **Observability**: `mxs logs tail`, `mxs metrics`.
- **OS keychain storage**: keytar / libsecret integration once monorepo Node version stabilises.
- **`mxs init`**: bootstrap a fresh mx-core deployment via compose.

## 14. Open Questions

None blocking. The following are implementation-time decisions:

- EJS template housing: inline constant vs `apps/core/assets/templates/device.ejs`. Default to file + inline fallback for first-boot.
- Whether `core/resolve.ts` caches across CLI invocations (a short-lived file cache in `~/.config/mxs/cache/`) or only per-invocation. v1 picks per-invocation.

## 15. Out-of-scope clarifications

- The CLI does **not** ship its own server bootstrapping commands. `apps/core` retains `migrate.ts` / `dev.ts` / `repl.ts` as today.
- The CLI does **not** replace `@mx-space/api-client`. It depends on it for HTTP plumbing.
- The CLI does **not** introduce new resource types in mx-core. Every command targets an existing controller; the only server-side additions are the `deviceAuthorization` plugin and the device verification controller.
