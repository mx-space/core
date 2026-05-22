# @mx-space/api-client

A framework-agnostic TypeScript/JavaScript SDK for the MX Space server (MServer v3). It wraps common API endpoints with typed request methods and response types for fast frontend and server-side integration.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Adapters](#adapters)
- [Controllers](#controllers)
- [Client Options](#client-options)
- [Proxy API](#proxy-api)
- [Version Compatibility & Migration](#version-compatibility--migration)
- [Development](#development)
- [License](#license)

---

## Requirements

- **Node.js** ≥ 22 (see `engines` in `package.json`)
- **MX Space server**: v12+ (PostgreSQL + Snowflake IDs) for api-client **v4.x**. See the [Version Compatibility & Migration](#version-compatibility--migration) section for older lines.

---

## Installation

From the monorepo root (recommended):

```bash
pnpm add @mx-space/api-client
```

Or with npm:

```bash
npm install @mx-space/api-client
```

The package is **framework-agnostic** and does not bundle a specific HTTP client. You must provide an adapter (e.g. Axios or fetch). Install the HTTP library you use:

```bash
pnpm add axios
# or use the built-in fetch adapter (no extra install)
```

---

## Quick Start

1. **Create a client** with an endpoint and an adapter.
2. **Inject controllers** you need (tree-shakeable).
3. **Call methods** on the client (e.g. `client.post`, `client.note`).

```ts
import {
  createClient,
  PostController,
  NoteController,
  AggregateController,
  CategoryController,
} from '@mx-space/api-client'
import { axiosAdaptor } from '@mx-space/api-client/adaptors/axios'

const endpoint = 'https://api.example.com/v2'
const client = createClient(axiosAdaptor)(endpoint)

client.injectControllers([
  PostController,
  NoteController,
  AggregateController,
  CategoryController,
])

// Typed API calls
const posts = await client.post.post.getList(1, 10, { year: 2024 })
const aggregate = await client.aggregate.getAggregateData()
```

**Optional: set token and interceptors** (example with Axios):

```ts
const $axios = axiosAdaptor.default
$axios.defaults.timeout = 10000
$axios.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers!.Authorization = `bearer ${token}`
  return config
})
```

---

## Architecture

- **Core**: `HTTPClient` in `core/client.ts` — builds a route proxy and delegates HTTP calls to an adapter.
- **Adapters**: Implement `IRequestAdapter` (get/post/put/patch/delete + optional `default` client). Responses are normalized to `{ data }`; optional `transformResponse` (e.g. camelCase) runs on `data`.
- **Controllers**: Classes that receive the client and attach methods under a name (e.g. `post`, `note`). Controllers are **injected at runtime** so you only bundle what you use.
- **Proxy**: `client.proxy` allows arbitrary path chains and HTTP methods for endpoints not modeled by a controller (e.g. `client.note.proxy.something.other('123').info.get()`).

**Response shape**: The adapter is expected to return a value with a `data` property. By default, `getDataFromResponse` uses `(res) => res.data`, and `transformResponse` converts keys to camelCase. Each returned object gets attached `$raw` (adapter response), `$request` (url, method, options), and `$serialized` (transformed data).

---

## Adapters

Official adapters live under `@mx-space/api-client/adaptors/`:

| Adapter        | Import path                              | Notes                    |
|----------------|------------------------------------------|--------------------------|
| **Axios**      | `@mx-space/api-client/adaptors/axios`   | Exposes `axiosAdaptor.default` (AxiosInstance). |
| **umi-request**| `@mx-space/api-client/adaptors/umi-request` | For umi-request users.  |
| **Fetch**      | `@mx-space/api-client/adaptors/fetch`   | Uses global `fetch`; no extra dependency. |

**Custom adapter**: Implement `IRequestAdapter` from `@mx-space/api-client` (methods: `get`, `post`, `put`, `patch`, `delete`; optional `default`). See `src/adaptors/axios.ts` and `src/adaptors/umi-request.ts` for reference.

---

## Controllers

Inject one or more controllers so the client exposes them (e.g. `client.post`, `client.note`). Use `allControllers` to inject everything, or list only what you need for smaller bundles.

| Controller   | Client name   | Purpose (high level)        |
|-------------|---------------|-----------------------------|
| PostController   | `post`    | Blog posts                  |
| NoteController   | `note`    | Notes / private posts       |
| PageController   | `page`    | Pages                       |
| CategoryController | `category` | Categories                |
| AggregateController | `aggregate` | Site aggregate data     |
| CommentController | `comment`  | Comments                    |
| UserController (owner) | `owner` | Auth, session, login, OAuth |
| SayController    | `say`     | Says / short notes          |
| LinkController   | `link`    | Links                       |
| SnippetController| `snippet` | Snippets                    |
| ProjectController | `project` | Projects                    |
| TopicController  | `topic`   | Topics                      |
| RecentlyController | `recently` | Recently items           |
| SearchController | `search`  | Search                      |
| ActivityController| `activity`| Activity                    |
| AIController     | `ai`      | AI-related endpoints        |
| SubscribeController | `subscribe` | Subscriptions            |
| ServerlessController | `serverless` | Serverless functions   |
| AckController    | `ack`     | Ack                         |

**Example — inject all controllers:**

```ts
import { createClient, allControllers } from '@mx-space/api-client'
import { axiosAdaptor } from '@mx-space/api-client/adaptors/axios'

const client = createClient(axiosAdaptor)('https://api.example.com/v2')
client.injectControllers(allControllers)
```

**Why inject manually?** To keep bundle size small (tree-shaking) and to avoid pulling in a specific HTTP library by default.

---

## Client Options

`createClient(adapter)(endpoint, options)` accepts optional second argument:

| Option                     | Description |
|----------------------------|-------------|
| `controllers`              | Array of controller classes to inject immediately. |
| `transformResponse`       | `(data) => transformed`. Default: camelCase keys. |
| `getDataFromResponse`     | `(response) => data`. Default: `(res) => res.data`. |
| `responseAdapter`         | Post-transform response adapter or adapter array. Use this for compatibility layers such as `@mx-space/api-client/legacy`. |
| `getCodeMessageFromException` | `(error) => { message?, code? }` for custom error parsing. |
| `customThrowResponseError` | `(error) => Error` to throw a custom error type. |

### Legacy V2 Compatibility

The V2 response shape keeps resource data flat and moves request-derived fields
to `$meta`. During downstream migrations, import the removable legacy layer from
the isolated `legacy` entry:

```ts
import { createClient } from '@mx-space/api-client'
import { axiosAdaptor } from '@mx-space/api-client/adaptors/axios'
import { legacyResponseAdapter } from '@mx-space/api-client/legacy'

const client = createClient(axiosAdaptor)('https://api.example.com/v2', {
  responseAdapter: legacyResponseAdapter(),
})
```

For a fast full-client opt-in:

```ts
import { createLegacyApiClient } from '@mx-space/api-client/legacy'

const client = createLegacyApiClient(axiosAdaptor)('https://api.example.com/v2')
```

For gradual migration, scope the adapter by path:

```ts
const client = createClient(axiosAdaptor)('https://api.example.com/v2', {
  responseAdapter: legacyResponseAdapter({
    only: ['/posts', 'GET /notes/latest'],
    except: ['/posts/latest'],
  }),
})
```

The legacy entry is intentionally separate from the main client. Once downstream
apps finish migration, remove imports from `@mx-space/api-client/legacy` and use
the default V2 shape directly.

---

## Proxy API

For paths not covered by a controller, use the **proxy** to build URLs and perform requests:

```ts
// GET /notes/something/other/123456/info
const data = await client.note.proxy.something.other('123456').info.get()

// Get path only (no request)
client.note.proxy.something.other('123456').info.toString()
// => '/notes/something/other/123456/info'

// Full URL (with base endpoint)
client.note.proxy.something.other('123456').info.toString(true)
// => 'https://api.example.com/v2/notes/something/other/123456/info'
```

---

## Version Compatibility & Migration

### Compatibility

| api-client version | Server version  | Notes |
|--------------------|-----------------|-------|
| **v4.x** (current) | ≥ 12            | PostgreSQL + Snowflake IDs. Pairs with the PG cutover. |
| v3.x               | 11 → early 12   | Transitional during the PG cutover. |
| v2.x               | 10 → 11         | MongoDB + Better Auth. ObjectId IDs. |
| v1.x               | ≤ 9             | Legacy JWT auth. |

### Migrating to v4 (server v12)

v12 swapped the storage layer from MongoDB to PostgreSQL with Snowflake IDs. Most route shapes are preserved by the response interceptor, but a few semantics changed for consumers:

- **IDs are strings everywhere.** Snowflake values are 64-bit integers and are serialized as decimal strings at the API boundary. Treat every `id`, `categoryId`, `topicId`, `parentId`, `relatedId`, etc. as `string`; never parse as `number`.
- **Pagination cursors.** Cursor-style endpoints that emit `before` / `after` now carry Snowflake strings instead of Mongo ObjectIds. Treat them as opaque tokens.
- **`shorthand` / `friend` aliases.** `allControllerNames` still exposes `friend` and `shorthand` for backwards-compatible consumer code.

### Migrating to v2 (legacy → Better Auth)

If you are still on v1 and upgrading the server to v10 (Better Auth), `user` / `master` controllers were unified under `owner`:

```diff
- client.user.getMasterInfo()
- client.master.getMasterInfo()
+ client.owner.getOwnerInfo()

- client.user.login(username, password)
+ client.owner.login(username, password, { rememberMe: boolean })
```

Login endpoint moved from `POST /master/login` to `POST /auth/sign-in`. The v2+ `login` returns `{ token, user }`. New auth helpers: `getSession`, `getAuthSession`, `logout`, `getAllowLoginMethods`, `getProviders`, `listSessions`, `revokeSession(token)`, `revokeSessions()`, `revokeOtherSessions()`.

### Downgrading

- `camelcase-keys` is no longer re-exported. Use the built-in helper:

```diff
- import { camelcaseKeysDeep, camelcaseKeys } from '@mx-space/api-client'
+ import { simpleCamelcaseKeys as camelcaseKeysDeep } from '@mx-space/api-client'
```

---

## Development

**From repo root:**

```bash
pnpm i
```

**From `packages/api-client`:**

- **Build**: `pnpm run package` or `pnpm run build` (cleans `dist`, runs `tsdown`).
- **Test**: `pnpm test` (Vitest).
- **Dev (watch tests)**: `pnpm run dev`.

**Project layout (high level):**

- `core/` — client, request attachment, error type.
- `controllers/` — one class per API area; names listed in `controllers/index.ts`.
- `adaptors/` — axios, umi-request, fetch.
- `models/`, `dtos/`, `interfaces/` — types and DTOs for requests/responses.
- `utils/` — path resolution, camelCase, auto-bind.

**Exports:**

- Main: `createClient`, `RequestError`, controllers, models, DTOs, `simpleCamelcaseKeys`, `HTTPClient` type, `IRequestAdapter` type.
- Adapters: `@mx-space/api-client/adaptors/axios`, `/adaptors/umi-request`, `/adaptors/fetch`.

---

## License

MIT.
