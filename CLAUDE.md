# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MX Space is a personal blog server application (AI-powered headless CMS) built with NestJS, PostgreSQL, and Redis. This is a monorepo containing the core server application and related packages. The main application is located in `apps/core/`.

## Related Projects

- **Dashboard (admin-vue3)**: `../admin-vue3` — 后台管理面板，Vue 3 项目
- **Frontend (Yohaku)**: `../Yohaku` — 主站前端 (Next.js)
- **haklex**: `../haklex` (standalone) — Rich editor packages (`@haklex/*`)

### Lexical Content Processing

mx-core uses `@haklex/rich-headless` (zero-React, server-side only) for Lexical JSON processing:
- `helper.lexical.service.ts` — `createHeadlessEditor()` + `allHeadlessNodes` + `$toMarkdown()` for JSON → Markdown conversion
- `ai-translation/lexical-translation-parser.ts` — AI translation content parsing
- After haklex releases, update the pinned version in `apps/core/package.json`

## Environment Requirements

- **Node.js**: >= 22 (see `.nvmrc` in root)
- **pnpm**: Use Corepack (`corepack enable`)

## Development Commands

All commands should be run from the repository root unless specified otherwise.

### Core Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build the project
- `pnpm bundle` - Create production bundle
- `pnpm test` - Run all tests
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier

### Running Single Tests
```bash
# Run a single test file
pnpm test -- test/src/modules/user/user.service.spec.ts

# Run tests matching a pattern
pnpm test -- --testNamePattern="should create user"

# Run tests in watch mode
pnpm -C apps/core run test:watch
```

### Core App Commands (from `apps/core/`)
- `npm run start:debug` - Start with debug mode
- `npm run start:cluster` - Start in cluster mode
- `npm run repl` - Start REPL mode

## Architecture Overview

### Directory Structure
- `apps/core/src/modules/` - Business logic modules (auth, posts, comments, etc.)
- `apps/core/src/processors/` - Infrastructure services (database, redis, gateway, helpers)
- `apps/core/src/common/` - Shared utilities (guards, interceptors, decorators)
- `apps/core/src/migration/` - Database migration scripts
- `apps/core/test/` - Test files and mocks
- `packages/` - Shared packages (api-client, webhook)

### Key Architectural Patterns

**API Route Prefix**: The `@ApiController()` decorator adds `/api/v{version}` prefix in production but no prefix in development. This allows direct access during development.

**Processors**: Infrastructure services organized in `processors/`:
- `database/` - PostgreSQL connection (Drizzle ORM), repository registry, base repository class
- `redis/` - Redis caching and pub/sub
- `gateway/` - WebSocket gateways for real-time features
- `helper/` - Utility services (email, image, JWT, Lexical, etc.)

**Database**: Uses PostgreSQL 16+ with Drizzle ORM. Schema definitions in `src/database/schema/`. Drizzle SQL migrations in `src/database/migrations/`. IDs are Snowflake `bigint` (serialized as strings at API boundaries). Repositories extend `BaseRepository` and are registered via `repository.tokens.ts`.

**Authentication**: Better Auth-based session management with decorators `@Auth()` for route protection and `@CurrentUser()` for accessing the authenticated user. Supports password, OAuth, Passkey, and API key (`x-api-key` header).

## API Response Rules

`ResponseInterceptor` auto-wraps responses:
- **Array** → `{ data: [...] }` (always wrapped)
- **Object** → returned directly (no wrapper)
- **@Paginator** → `{ data: [...], pagination: {...} }` (requires `model.paginate()` result)
- **@Bypass** → skips all transformation

`JSONTransformInterceptor` converts all keys to **snake_case** (e.g., `createdAt` → `created_at`)

## Testing

Uses Vitest with PostgreSQL testcontainers (`@testcontainers/postgresql`) and Redis memory server.

### E2E Test Pattern
Use `createE2EApp` helper from `test/helper/create-e2e-app.ts`. Tests requiring PostgreSQL use `startPgTestContainer()` from `test/helper/pg-testcontainer.ts`.
```typescript
import { createE2EApp } from 'test/helper/create-e2e-app'

const proxy = createE2EApp({
  imports: [...],
  controllers: [MyController],
  providers: [...],
})

it('should work', async () => {
  const res = await proxy.app.inject({ method: 'GET', url: '/...' })
  expect(res.statusCode).toBe(200)
})
```

### Test Helpers
- `test/helper/pg-testcontainer.ts` - Ephemeral PostgreSQL 17 container per test run
- `test/helper/pg-repository-mock.ts` - Repository mock utilities
- `test/helper/redis-mock.helper.ts` - Redis mock
- `test/helper/create-mock-global-module.ts` - Global module mocking
- `test/mock/modules/` - Module-level mocks (auth, redis, gateway)
- `test/mock/processors/` - Processor mocks (email, event)

## Database Migrations

Database migrations use Drizzle Kit. SQL migration files live in `src/database/migrations/` (e.g. `0000_initial.sql`). Historical data migrations from the MongoDB era are in `src/migration/postgres-data-migration/`.

## Configuration

Configuration via `src/app.config.ts` supports:
- Environment variables
- Command line arguments
- YAML configuration files
