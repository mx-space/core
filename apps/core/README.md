# Mix Space Core

> **Mix Space Core** — AI-powered headless CMS built on [NestJS](https://github.com/nestjs/nest) (Node.js). Requires [PostgreSQL 16+](https://www.postgresql.org/) and [Redis](https://redis.io/).

The backend of the Mix Space stack — package `@mx-space/core`. The repo root
([`../../README.md`](../../README.md)) describes the whole monorepo.

## Pair with a frontend

Core ships only the API. Pair it with one of:

- [Yohaku](https://github.com/Innei/Yohaku) (Next.js, recommended)
- [Shiro](https://github.com/innei/shiro) (minimalist)
- [Kami](https://github.com/mx-space/kami) (anime-flavored, legacy)

**Notable built-in modules:**

- [Serverless functions](./src/modules/serverless/serverless.readme.md)

**Third-party integrations:**

- Bark push notifications
- Email subscriptions

## Tech Stack

| Component  | Technology                                |
|------------|-------------------------------------------|
| Runtime    | Node.js >= 22 + TypeScript 6              |
| Framework  | NestJS 11 + Fastify                       |
| Database   | PostgreSQL 16 (Drizzle ORM)               |
| Cache      | Redis (ioredis)                           |
| Validation | Zod 4 (nestjs-zod)                        |
| WebSocket  | Socket.IO + Redis Emitter                 |
| AI         | OpenAI SDK, Anthropic SDK                 |
| Editor     | Lexical (`@haklex/rich-headless`)         |
| Auth       | Better Auth (session, passkey, API key)   |
| Testing    | Vitest + PostgreSQL testcontainers        |
| ID         | Snowflake bigint (serialized as string)   |

## Local Development

Requirements: Node.js 22+, PostgreSQL 16+, Redis 7.x.

```bash
corepack enable          # enable pnpm
pnpm install
docker compose up -d postgres redis
pnpm dev
```

In development the API listens on `http://localhost:2333` with no `/api/v2`
prefix. `pnpm dev` applies pending schema migrations automatically before boot
(see `src/dev.ts`).

## Docker Deployment (recommended)

```bash
git clone https://github.com/mx-space/core.git mx-core
cd mx-core
cp docker-compose.server.yml docker-compose.prod.yml
# Edit docker-compose.prod.yml — set JWT_SECRET, ALLOWED_ORIGINS, etc.
docker compose -f docker-compose.prod.yml up -d
```

Or pull the prebuilt image directly:

```bash
docker pull innei/mx-server:latest
```

The image supports `linux/amd64` and `linux/arm64`.

## Bare-metal Deployment

Download the release bundle from
[GitHub Releases](https://github.com/mx-space/core/releases/latest), extract it,
then run:

```
node index.js
```

All dependencies are bundled into the artifact — no `node_modules` required.

> [!NOTE]
> Stack traces in the bundled artifact are minified. If you hit an issue, start
> with `node index.debug.js`, reproduce the problem, capture the full stack
> trace, and file an issue.

## Database Migrations (release-phase)

Schema migrations do **not** run on app startup. They are a one-shot
release-phase step. mx-core boots only after **verifying** the schema is at the
expected version — otherwise it fails fast and refuses to start.

Design document:
[docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md](../../docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md)

### Local Development

`pnpm dev` applies pending schema migrations automatically before the server
starts — no manual step required. To run it explicitly:

```bash
pnpm -C apps/core run migrate          # apply pending migrations
pnpm -C apps/core run lint:migrations  # audit new migrations for safety
```

After adding or modifying schema files:

```bash
pnpm -C apps/core exec drizzle-kit generate   # generate the SQL migration
pnpm -C apps/core run lint:migrations         # same check CI runs
```

`lint:migrations` enforces expand-contract semantics so that an old pod is never
broken by a new schema during a rolling deploy. To bypass a rule, add
`-- migration-lint:allow=<rule> reason=<why>` — the reason is mandatory.

### Docker / Production

Both `docker-compose.yml` and `docker-compose.server.yml` include a one-shot
`mx-migrate` service. `docker compose up` runs it first; `mx-core` only starts
after `mx-migrate` exits with code 0. No manual step is needed.

For multi-replica rolling deploys, the orchestrator (Dokploy / Kubernetes)
handles ordering. The compose-level `service_completed_successfully` guard
ensures migrations complete before any `mx-core` instance starts.

### Authoring Schema Changes

Before writing a migration, read the Claude skill at
[`../../.claude/skills/mx-migration-author/SKILL.md`](../../.claude/skills/mx-migration-author/SKILL.md)
— it contains an expand-contract decision tree and multi-release templates for
common operations.

## Project Layout

```
src/
├── common/                        # middleware, decorators, guards, interceptors, pipes, filters
├── constants/                     # constants (business events, cache keys, error codes)
├── database/                      # database layer
│   ├── schema/                    #   Drizzle table definitions
│   ├── migrations/                #   Drizzle SQL migrations (release-phase)
│   └── app-migrations/            #   application-layer one-shot data fixups
├── modules/                       # 50 business modules (ai, auth, post, note, comment …)
├── processors/                    # infrastructure services
│   ├── database/                  #   PG connection + repository registry + BaseRepository
│   ├── redis/                     #   cache / pub-sub / emitter
│   ├── gateway/                   #   WebSocket (admin, web, shared)
│   ├── task-queue/                #   distributed task queue (Redis + Lua)
│   └── helper/                    #   Email, Image, JWT, Lexical …
├── shared/                        # shared DTOs, interfaces, Zod schemas
├── transformers/                  # response transformers (snake_case, pagination)
└── utils/                         # utility modules
```

> The historical MongoDB → PostgreSQL data migration has been extracted into a
> dedicated CLI: [`packages/mongo-pg-cli`](../../packages/mongo-pg-cli).

## Application Flow

- **Request pipeline**
  1. `request` — incoming request received
  2. `middleware` — filters scanner/bot probes (PHP exploits, etc.) and records visit history
  3. `guard` — authentication + role enrichment
  4. `interceptor:before` — DEBUG-only request timing
  5. `pipe` — request validation; rejects unknown fields and invalid types with HTTP 422
  6. `controller` & `resolver` — business controllers
  7. `service` — business services
  8. `interceptor:after` — response formatting + request-level caching
  9. `filter` — captures any exception thrown above and returns the error response

- **Interceptor order**

```
ResponseInterceptor -> ResponseFilterInterceptor -> JSONTransformInterceptor -> CountingInterceptor -> AnalyzeInterceptor -> HttpCacheInterceptor
```

### Business Modules (`modules/`)

Ack · Activity · Aggregate · AI (summary / translation / insights / writer / agent / moderation) · Analyze · Auth (Better Auth) · Backup · Category · Comment · Configs · Cron-task · Debug · Dependency · Draft · Enrichment · Feed · File · Health · Helper · Init · Link · Markdown · Meta-preset · Note · Option · Owner · Page · Pageproxy · Poll · Post · Project · Reader · Recently · Render · Say · Search · Server-time · Serverless · Sitemap · Slug-tracker · Snippet · Subscribe · Topic · Update · Webhook

### Infrastructure (`processors/`)

| Service    | Responsibility |
|------------|----------------|
| database   | PostgreSQL connection + Drizzle ORM + repository registry |
| redis      | cache / pub-sub / emitter |
| gateway    | Socket.IO (web, admin, shared namespaces) |
| task-queue | distributed task queue backed by Redis + Lua |
| helper     | Email · Image · JWT · Lexical · URL Builder · BarkPush · TqService |

## Commands

Run inside `apps/core/` (or use the equivalent root alias from the repo root):

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (watch mode) |
| `pnpm build` | Build the application (alias for `bundle`) |
| `pnpm bundle` | Production bundle (Vite) |
| `pnpm migrate` | Apply pending forward migrations |
| `pnpm lint:migrations` | Audit migrations for expand-contract safety |
| `pnpm openapi:check` | Verify the committed OpenAPI manifest matches the server |
| `pnpm test` | Run test suite (Vitest) |
| `pnpm test:watch` | Watch mode |
| `pnpm lint` | Run ESLint with auto-fix |
| `pnpm typecheck` | TypeScript type checking |

### Running Tests

```bash
pnpm test                                                 # all tests
pnpm test -- test/src/modules/post/post.service.spec.ts   # one file
pnpm test -- --testNamePattern="should create"            # by name
pnpm test:watch                                           # watch mode
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT signing | Required |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | — |
| `PG_URL` | Full PostgreSQL connection string | — |
| `PG_HOST` | PostgreSQL host | `127.0.0.1` |
| `PG_PORT` | PostgreSQL port | `5432` |
| `PG_USER` | PostgreSQL user | `mx` |
| `PG_PASSWORD` | PostgreSQL password | `mx` |
| `PG_DATABASE` | PostgreSQL database name | `mx_core` |
| `PG_MAX_POOL_SIZE` | PostgreSQL connection pool size | `20` |
| `PG_SSL` | Enable PostgreSQL SSL | `false` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | — |
| `SNOWFLAKE_WORKER_ID` | Snowflake ID worker ID (0–1023) | Required |
| `ENCRYPT_ENABLE` | Enable field encryption | `false` |
| `ENCRYPT_KEY` | 64-char hex encryption key | — |
| `THROTTLE_TTL` | Rate limit window (seconds) | `10` |
| `THROTTLE_LIMIT` | Max requests per window | `100` |
| `PORT` | Server port | `2333` |
| `TZ` | Timezone | `Asia/Shanghai` |
| `DISABLE_CACHE` | Disable Redis caching | `false` |

Configuration can also be provided via CLI arguments or YAML files. See
`src/app.config.ts` for the full config schema.

## API Response Format

Every successful JSON response has the shape `{ data, meta? }`; every error has
the shape `{ error: { code, message, details? } }`.

- A controller returning a bare value `T` → `{ data: T }` (via global `ResponseInterceptor`).
- Returning `withMeta(value, meta)` (see `~/common/response/envelope.types`) → `{ data, meta }`. Detection is by an internal `Symbol`, so returning a literal `{ data, ... }` is double-wrapped — CI enforces this via `scripts/check-controller-response-envelope.ts`.
- Returning `undefined` → `204 No Content`.
- `@HTTPDecorators.RawResponse` — opt out of the envelope/casing pipeline for non-JSON (streams, HTML, RSS, redirects).

**Case conversion** — code is camelCase end-to-end (DTOs, services, Drizzle column TS props). Incoming requests are normalized to camelCase by `RequestCaseNormalizationPipe`; outgoing `data`/`meta` are converted back to snake_case at the wire boundary. The wire format stays **snake_case** (e.g., `createdAt` → `created_at`). Use `@BypassCaseTransform([paths])` to keep free-form JSON subtrees untouched.

**Errors** — throw `AppException` subclasses (`BizException`, `CannotFindException`, etc.) with a stable `SCREAMING_SNAKE` code; `AppExceptionFilter` maps them to the unified error envelope.

## Upgrading

### v11 → v12

> [!WARNING]
> v12 migrates the database from MongoDB to PostgreSQL. This is a hard cutover:
> all data must be migrated through the provided CLI before starting the new
> version.

See [Upgrading to v12](../../docs/migrations/v12.md).

### v10 → v11

v11 refactors the Aggregate API: `categories` and `pageMeta` are removed from
`GET /aggregate`; a new `GET /aggregate/site` endpoint is added for lightweight
site metadata. See [Upgrading to v11](../../docs/migrations/v11.md).

### v9 → v10

v10 includes a breaking auth system refactor. See
[Upgrading to v10](../../docs/migrations/v10.md).

## Credits

Inspired in part by [nodepress](https://github.com/surmon-china/nodepress).

---

Since 2021-08-31.
