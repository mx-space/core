# MX Space Core

[![GitHub stars](https://img.shields.io/github/stars/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/stargazers)
[![GitHub issues](https://img.shields.io/github/issues-raw/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/issues)
[![Build Core](https://github.com/mx-space/core/actions/workflows/ci.yml/badge.svg)](https://github.com/mx-space/core/actions/workflows/ci.yml)
[![Release](https://github.com/mx-space/core/actions/workflows/release.yml/badge.svg)](https://github.com/mx-space/core/actions/workflows/release.yml)
[![GitHub license](https://img.shields.io/github/license/mx-space/mx-server.svg?style=flat)](https://github.com/mx-space/mx-server/blob/main/LICENSE)
[![wakatime](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/8afd37d1-7501-426f-824b-50aeeb96bb6f.svg)](https://wakatime.com/badge/user/9213dc96-df0d-4e66-b0bb-50f9e04e988c/project/8afd37d1-7501-426f-824b-50aeeb96bb6f)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/innei/mx-server)](https://hub.docker.com/repository/docker/innei/mx-server)

> **MX Space Core** — AI-powered headless CMS built on [`NestJS`](https://github.com/nestjs/nest) (Node.js). Requires [`PostgreSQL 16+`](https://www.postgresql.org/) and [`Redis`](https://redis.io/) to run.

This project ships only the API. Pair it with one of the following frontends:

- [Yohaku](https://github.com/Innei/Yohaku) (Next.js, recommended)
- [Shiro](https://github.com/innei/shiro) (minimalist)
- [Kami](https://github.com/mx-space/kami) (anime-flavored, legacy)

Notable built-in modules:

- [Serverless functions](./src/modules/serverless/serverless.readme.md)

Third-party integrations:

- Bark push notifications
- Email subscriptions

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

Requirements:

- Node.js 22+
- PostgreSQL 16+
- Redis 7.x

Download the release bundle from [GitHub Releases](https://github.com/mx-space/core/releases/latest), extract it, then run:

```
node index.js
```

All dependencies are bundled into the artifact — no `node_modules` required.

> [!NOTE]
> Stack traces in the bundled artifact are minified. If you hit an issue, start with `node index.debug.js`, reproduce the problem, capture the full stack trace, and file an issue.

## Development

```bash
corepack enable  # enable pnpm
git clone https://github.com/mx-space/core mx-core
cd mx-core
pnpm i
docker compose up -d postgres redis  # start PostgreSQL + Redis
pnpm dev
```

In development the API listens on `http://localhost:2333` with no `/api/v2` prefix.

## Database Migrations (release-phase)

Schema migrations do **not** run on app startup. They are a one-shot release-phase step. mx-core boots only after **verifying** the schema is at the expected version — otherwise it fails fast and refuses to start.

Design document: [docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md](../../docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md)

### Local Development

`pnpm dev` runs `pnpm migrate` automatically via the `predev` hook — no manual step required. To run it explicitly:

```bash
pnpm -C apps/core run migrate          # apply pending migrations
pnpm -C apps/core run lint:migrations  # audit new migrations for safety
```

After adding or modifying schema files:

```bash
pnpm -C apps/core exec drizzle-kit generate   # generate the SQL migration
pnpm -C apps/core run lint:migrations         # same check CI runs
```

`lint:migrations` enforces expand-contract semantics so that an old pod is never broken by a new schema during a rolling deploy. To bypass a rule, add `-- migration-lint:allow=<rule> reason=<why>` — the reason is mandatory.

### Docker / Production

Both `docker-compose.yml` and `docker-compose.server.yml` include a one-shot `mx-migrate` service. `docker compose up` runs it first; `mx-core` only starts after `mx-migrate` exits with code 0. No manual step is needed.

For multi-replica rolling deploys, the orchestrator (Dokploy / Kubernetes) handles ordering. The compose-level `service_completed_successfully` guard ensures migrations complete before any `mx-core` instance starts.

### Authoring Schema Changes

Before writing a migration, read the Claude skill at `.claude/skills/mx-migration-author/SKILL.md` — it contains an expand-contract decision tree and multi-release templates for common operations.

## Project Layout

```
.
├── common/                        # middleware, decorators, guards, interceptors, pipes, filters
├── constants/                     # constants (business events, cache keys, error codes)
├── database/                      # database layer
│   ├── schema/                    #   Drizzle table definitions
│   ├── migrations/                #   Drizzle SQL migrations (release-phase)
│   └── app-migrations/            #   application-layer one-shot data fixups
├── modules/                       # 45 business modules (ai, auth, post, note, comment …)
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

> The historical MongoDB → PostgreSQL data migration has been extracted into a dedicated CLI: [`packages/mongo-pg-cli`](../../packages/mongo-pg-cli).

## Application Flow

- **Request pipeline**
  1. `request` — incoming request received
  1. `middleware` — filters scanner/bot probes (PHP exploits, etc.) and records visit history
  1. `guard` — authentication + role enrichment
  1. `interceptor:before` — DEBUG-only request timing
  1. `pipe` — request validation; rejects unknown fields and invalid types with HTTP 422
  1. `controller` & `resolver` — business controllers
  1. `service` — business services
  1. `interceptor:after` — response formatting + request-level caching
  1. `filter` — captures any exception thrown above and returns the error response

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

## Quick Dev Loop

```bash
pnpm i
docker compose up -d postgres redis
pnpm dev
```

## Tech Stack

| Component  | Technology                                |
|------------|-------------------------------------------|
| Runtime    | Node.js >= 22 + TypeScript 5.9            |
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

## Credits

Inspired in part by [nodepress](https://github.com/surmon-china/nodepress).

---

Since 2021-08-31

Thanks.
