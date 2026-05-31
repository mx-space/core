<p align="center">
  <img src="./.github/branding/logo-icon.png" alt="mx-space" width="120" />
</p>

<h1 align="center">MX Space Core</h1>

<p align="center">
  AI-powered CMS Core for personal blogs, creator homepages & content websites.
</p>

<p align="center">
  <a href="https://github.com/mx-space/core/releases"><img src="https://img.shields.io/github/v/release/mx-space/core?style=flat-square" alt="Release" /></a>
  <a href="https://github.com/mx-space/core/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/mx-space/core/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://github.com/mx-space/core/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3%20%2B%20MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square" alt="Node.js" /></a>
  <a href="https://hub.docker.com/r/innei/mx-server"><img src="https://img.shields.io/docker/pulls/innei/mx-server?style=flat-square" alt="Docker Pulls" /></a>
  <a href="https://t.me/+lRRxARqVZC1mYTc9"><img src="https://img.shields.io/badge/Telegram-Join-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram" /></a>
</p>

---

## Overview

MX Space Core is a headless CMS server built with **NestJS**, **PostgreSQL**, and **Redis**. Beyond standard blog features (posts, pages, notes, comments, categories, feeds, search), it ships with a full AI content workflow — summary generation, multi-language translation, comment moderation, and writing assistance — powered by pluggable LLM providers.

### Key Features

| Category | Capabilities |
|----------|-------------|
| **Content Management** | Posts, notes, pages, drafts, categories, topics, comments, snippets, projects, friend links, subscriptions |
| **AI Workflow** | Summary generation, multi-language translation, comment moderation, writing assistance, streaming responses |
| **LLM Providers** | OpenAI, OpenAI-compatible, Anthropic, OpenRouter |
| **Real-time** | WebSocket via Socket.IO with Redis adapter for multi-instance broadcast |
| **Distribution** | RSS/Atom feeds, sitemap, local search, aggregate API |
| **Auth** | Better Auth sessions, passkeys, OAuth, API keys (`x-api-key` header) |
| **Deployment** | Docker (multi-arch), PM2, standalone binary |

## Tech Stack

- **Runtime**: Node.js >= 22 + TypeScript 5.9
- **Framework**: NestJS 11 + Fastify
- **Database**: PostgreSQL 16 (Drizzle ORM)
- **Cache**: Redis (ioredis)
- **Validation**: Zod 4
- **WebSocket**: Socket.IO + Redis Emitter
- **AI**: OpenAI SDK, Anthropic SDK
- **Editor**: Lexical (via @haklex/rich-headless)
- **Auth**: better-auth (session, passkey, OAuth, API key)
- **Admin SPA**: React 19 + Vite + Base UI + Tailwind v4 (`apps/admin`)
- **Testing**: Vitest + PostgreSQL testcontainers / Redis memory server

## Monorepo Structure

```
mx-core/
├── apps/
│   ├── core/                 # Main server application (NestJS + Fastify)
│   └── admin/                # @mx-admin/admin — React 19 SPA, built locally and served at /proxy/qaqdmin
├── packages/
│   ├── api-client/           # @mx-space/api-client — typed SDK for frontend & third-party clients
│   ├── cli/                  # @mx-space/cli (mxs) — owner-side CLI for content + config (Effect-TS)
│   ├── db-schema/            # @mx-space/db-schema — shared Drizzle schema + Snowflake utilities (private)
│   ├── mongo-pg-cli/         # @mx-space/mongo-pg-cli — one-shot v11→v12 (MongoDB→PostgreSQL) data migration
│   └── webhook/              # @mx-space/webhook — signature-verified webhook handler SDK
├── docker-compose.yml        # Development stack (PostgreSQL + Redis + mx-migrate)
├── dockerfile                # Multi-stage production build
└── docker-compose.server.yml # Production deployment template
```

### Core Architecture (`apps/core/src/`)

```
src/
├── modules/          # 45 business modules
│   ├── ai/           #   AI summary, translation, insights, writer, agent, task queue
│   ├── auth/         #   Better Auth: session, OAuth, passkey, API key
│   ├── post/         #   Blog posts
│   ├── note/         #   Short notes with topic support
│   ├── comment/      #   Nested comments + AI moderation + reader image upload
│   ├── configs/      #   Runtime configuration
│   ├── enrichment/   #   URL extraction, screenshot pipeline
│   ├── reader/       #   Reader identity / image quotas
│   ├── webhook/      #   Event dispatch to external services
│   ├── serverless/   #   User-defined serverless functions
│   └── ...           #   page, draft, category, topic, feed, search, owner, etc.
├── processors/       # Infrastructure services
│   ├── database/     #   PostgreSQL connection + repository registry + BaseRepository
│   ├── redis/        #   Cache, pub/sub, emitter
│   ├── gateway/      #   WebSocket (admin, web, shared namespaces)
│   ├── task-queue/   #   Distributed job queue (Redis + Lua)
│   └── helper/       #   Email, image, JWT, Lexical, URL builder, etc.
├── database/         # Drizzle ORM
│   ├── schema/       #   Table definitions
│   └── migrations/   #   SQL migration files (release-phase, never run on boot)
├── common/           # Guards, interceptors, decorators, filters, pipes
├── constants/        # Business events, cache keys, error codes
├── transformers/     # Response transformation (snake_case, pagination)
└── utils/            # Utility modules
```

> Historical MongoDB → PostgreSQL data migration lives in [`packages/mongo-pg-cli`](./packages/mongo-pg-cli). Forward schema migrations live in `apps/core/src/database/migrations/` and run as a one-shot release-phase step (see the [release-phase migration design](./docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md)).

## Quick Start

### Prerequisites

| Dependency | Version |
|-----------|---------|
| Node.js | >= 22 |
| pnpm | Latest (via Corepack) |
| PostgreSQL | 16+ |
| Redis | 7.x |

### Local Development

```bash
# Enable Corepack for pnpm
corepack enable

# Install dependencies
pnpm install

# Start PostgreSQL + Redis (via Docker)
docker compose up -d postgres redis

# Start dev server (port 2333)
pnpm dev
```

The API is available at `http://localhost:2333`. In development mode, routes have no `/api/v2` prefix.

### Docker Deployment

The fastest way to get a production instance running:

```bash
# Clone and enter the project
git clone https://github.com/mx-space/core.git && cd core

# Edit environment variables
cp docker-compose.server.yml docker-compose.prod.yml
# Edit docker-compose.prod.yml — set JWT_SECRET, ALLOWED_ORIGINS, etc.

# Start all services
docker compose -f docker-compose.prod.yml up -d
```

Or use the prebuilt image directly:

```bash
docker pull innei/mx-server:latest
```

The image supports `linux/amd64` and `linux/arm64`.

## Available Commands

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (watch mode) |
| `pnpm build` | Build the core application |
| `pnpm bundle` | Create production bundle (tsdown) |
| `pnpm test` | Run test suite (Vitest) |
| `pnpm lint` | Run ESLint with auto-fix |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm format` | Format code with Prettier |

### Running Tests

```bash
# Run all tests
pnpm test

# Run a specific test file
pnpm test -- test/src/modules/user/user.service.spec.ts

# Run tests matching a pattern
pnpm test -- --testNamePattern="should create user"

# Watch mode
pnpm -C apps/core run test:watch
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

Configuration can also be provided via CLI arguments or YAML files. See `apps/core/src/app.config.ts` for the full config schema.

## API Response Format

Every successful JSON response has the shape `{ data, meta? }`; every error has the shape `{ error: { code, message, details? } }`.

- A controller returning a bare value `T` → `{ data: T }` (via global `ResponseInterceptor`).
- Returning `withMeta(value, meta)` (see `~/common/response/envelope.types`) → `{ data, meta }`. Detection is by an internal `Symbol`, so returning a literal `{ data, ... }` is double-wrapped — CI enforces this via `scripts/check-controller-response-envelope.ts`.
- Returning `undefined` → `204 No Content`.
- `@HTTPDecorators.RawResponse` — opt out of the envelope/casing pipeline for non-JSON (streams, HTML, RSS, redirects).

**Case conversion** — code is camelCase end-to-end (DTOs, services, Drizzle column TS props). Incoming requests are normalized to camelCase by `RequestCaseNormalizationPipe`; outgoing `data`/`meta` are converted back to snake_case at the wire boundary. The wire format stays **snake_case** (e.g., `createdAt` → `created_at`). Use `@BypassCaseTransform([paths])` to keep free-form JSON subtrees untouched.

**Errors** — throw `AppException` subclasses (`BizException`, `CannotFindException`, etc.) with a stable `SCREAMING_SNAKE` code; `AppExceptionFilter` maps them to the unified error envelope.

## Upgrading

### v11 → v12

v12 migrates the database from MongoDB to PostgreSQL. This is a hard cutover: all data must be migrated through the provided CLI before starting the new version. See [Upgrading to v12](./docs/migrations/v12.md).

### v10 → v11

v11 refactors the Aggregate API: `categories` and `pageMeta` are removed from `GET /aggregate`; a new `GET /aggregate/site` endpoint is added for lightweight site metadata. See [Upgrading to v11](./docs/migrations/v11.md).

### v9 → v10

v10 includes a breaking auth system refactor. See [Upgrading to v10](./docs/migrations/v10.md).

## Related Projects

| Project | Description |
|---------|-------------|
| [Yohaku](https://github.com/Innei/Yohaku) | Next.js frontend |
| [`apps/admin`](./apps/admin) | `@mx-admin/admin` — React 19 admin dashboard (in-repo, built into the server release) |
| [@mx-space/api-client](./packages/api-client) | TypeScript API client SDK |
| [@mx-space/cli](./packages/cli) | `mxs` CLI for posts/notes/pages/config (OIDC device auth) |
| [@mx-space/mongo-pg-cli](./packages/mongo-pg-cli) | One-shot MongoDB → PostgreSQL migration for v11 → v12 |
| [@mx-space/webhook](./packages/webhook) | Webhook handler SDK (signature-verified) |
| [@haklex/rich-headless](https://github.com/innei/haklex) | Lexical editor (server-side) |

## License

- **`apps/`** — [AGPLv3 with Additional Terms](./ADDITIONAL_TERMS.md)
- **Everything else** — [MIT](./LICENSE)

See [LICENSE](./LICENSE) for full details.
