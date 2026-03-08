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
</p>

---

## Overview

MX Space Core is a headless CMS server built with **NestJS**, **MongoDB**, and **Redis**. Beyond standard blog features (posts, pages, notes, comments, categories, feeds, search), it ships with a full AI content workflow — summary generation, multi-language translation, comment moderation, and writing assistance — powered by pluggable LLM providers.

### Key Features

| Category | Capabilities |
|----------|-------------|
| **Content Management** | Posts, notes, pages, drafts, categories, topics, comments, snippets, projects, friend links, subscriptions |
| **AI Workflow** | Summary generation, multi-language translation, comment moderation, writing assistance, streaming responses |
| **LLM Providers** | OpenAI, OpenAI-compatible, Anthropic, OpenRouter |
| **Real-time** | WebSocket via Socket.IO with Redis adapter for multi-instance broadcast |
| **Distribution** | RSS/Atom feeds, sitemap, Algolia search, aggregate API |
| **Auth** | JWT sessions, passkeys, OAuth, API keys (via better-auth) |
| **Deployment** | Docker (multi-arch), PM2, standalone binary |

## Tech Stack

- **Runtime**: Node.js >= 22 + TypeScript 5.9
- **Framework**: NestJS 11 + Fastify
- **Database**: MongoDB 7 (Mongoose / TypeGoose)
- **Cache**: Redis (ioredis)
- **Validation**: Zod 4
- **WebSocket**: Socket.IO + Redis Emitter
- **AI**: OpenAI SDK, Anthropic SDK
- **Editor**: Lexical (via @haklex/rich-headless)
- **Auth**: better-auth (session, passkey, API key)
- **Testing**: Vitest + in-memory MongoDB/Redis

## Monorepo Structure

```
mx-core/
├── apps/
│   └── core/                 # Main server application (NestJS)
├── packages/
│   ├── api-client/           # @mx-space/api-client — SDK for frontend & third-party clients
│   └── webhook/              # @mx-space/webhook — Webhook integration SDK
├── docker-compose.yml        # Development stack (Mongo + Redis)
├── dockerfile                # Multi-stage production build
└── docker-compose.server.yml # Production deployment template
```

### Core Architecture (`apps/core/src/`)

```
src/
├── modules/          # 44 business modules
│   ├── ai/           #   AI summary, translation, writer, task queue
│   ├── auth/         #   JWT, OAuth, passkey, API key
│   ├── post/         #   Blog posts
│   ├── note/         #   Short notes with topic support
│   ├── comment/      #   Nested comments + AI moderation
│   ├── configs/      #   Runtime configuration
│   ├── webhook/      #   Event dispatch to external services
│   ├── serverless/   #   User-defined serverless functions
│   └── ...           #   page, draft, category, topic, feed, search, etc.
├── processors/       # Infrastructure services
│   ├── database/     #   MongoDB connection + model registry
│   ├── redis/        #   Cache, pub/sub, emitter
│   ├── gateway/      #   WebSocket (admin, web, shared namespaces)
│   ├── task-queue/   #   Distributed job queue (Redis + Lua)
│   └── helper/       #   Email, image, JWT, Lexical, URL builder, etc.
├── common/           # Guards, interceptors, decorators, filters, pipes
├── constants/        # Business events, cache keys, error codes
├── transformers/     # Response transformation (snake_case, pagination)
├── migration/        # Versioned DB migrations (v2 → v10)
└── utils/            # 34 utility modules
```

## Quick Start

### Prerequisites

| Dependency | Version |
|-----------|---------|
| Node.js | >= 22 |
| pnpm | Latest (via Corepack) |
| MongoDB | 7.x |
| Redis | 7.x |

### Local Development

```bash
# Enable Corepack for pnpm
corepack enable

# Install dependencies
pnpm install

# Start MongoDB + Redis (via Docker)
docker compose up -d mongo redis

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
| `DB_HOST` | MongoDB host | `localhost` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | — |
| `MONGO_CONNECTION` | Full MongoDB connection string (overrides DB_HOST) | — |
| `ENCRYPT_ENABLE` | Enable field encryption | `false` |
| `ENCRYPT_KEY` | 64-char hex encryption key | — |
| `THROTTLE_TTL` | Rate limit window (seconds) | `10` |
| `THROTTLE_LIMIT` | Max requests per window | `100` |
| `PORT` | Server port | `2333` |
| `TZ` | Timezone | `Asia/Shanghai` |
| `DISABLE_CACHE` | Disable Redis caching | `false` |

Configuration can also be provided via CLI arguments or YAML files. See `apps/core/src/app.config.ts` for the full config schema.

## API Response Format

All responses are automatically transformed by interceptors:

- **Array** → `{ data: [...] }`
- **Object** → returned as-is
- **Paginated** (via `@Paginator`) → `{ data: [...], pagination: {...} }`
- **Bypass** (via `@Bypass`) → raw response

All response keys are converted to **snake_case** (e.g., `createdAt` → `created_at`).

## Upgrading

### v9 → v10

v10 includes a breaking auth system refactor. See [Upgrading to v10](./docs/migrations/v10.md).

## Related Projects

| Project | Description |
|---------|-------------|
| [Shiroi](https://github.com/innei-dev/Shiroi) | Next.js frontend |
| [mx-admin](https://github.com/mx-space/mx-admin) | Vue 3 admin dashboard |
| [@mx-space/api-client](./packages/api-client) | TypeScript API client SDK |
| [@haklex/rich-headless](https://github.com/innei/haklex) | Lexical editor (server-side) |

## License

- **`apps/`** — [AGPLv3 with Additional Terms](./ADDITIONAL_TERMS.md)
- **Everything else** — [MIT](./LICENSE)

See [LICENSE](./LICENSE) for full details.
