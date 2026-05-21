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

Every successful JSON response has the shape `{ data, meta? }`. Every error has the shape `{ error: { code, message, details? } }`.

**Success envelope** — `ResponseInterceptorV2` (global `APP_INTERCEPTOR`) wraps controller return values:
- A bare value `T` → `{ data: T }`
- A value already shaped as `{ data, meta? }` → passed through unchanged
- `undefined` → `204 No Content`

**Error envelope** — `AppExceptionFilter` (global `APP_FILTER`) maps every thrown error:
- `AppException` (and subclasses) → `{ error: { code, message, details? } }` at the exception's HTTP status
- `ZodError` → 400 `VALIDATION_FAILED` with `details.issues`
- Other `HttpException` → `{ error: { code: 'HTTP_ERROR', message } }`
- Unknown errors → 500 `INTERNAL_ERROR`

**Exceptions** — extend `AppException` with a stable `SCREAMING_SNAKE` code:
```ts
throw new BizException(ErrorCodeEnum.PostNotFound)    // code: 'PostNotFound', 404
throw new CannotFindException()                        // code: 'NOT_FOUND', 404
throw new BanInDemoExcpetion()                         // code: 'DEMO_FORBIDDEN', 403
throw new NoContentCanBeModifiedException()            // code: 'NO_CONTENT_MODIFIABLE', 400
```

**Meta** — use `MetaObjectBuilder` for cross-cutting per-request data (pagination, translation, enrichment, interaction). Located in `src/common/response/meta-builder.ts`.

**Named views** — field selection uses `*.views.ts` Zod schemas (e.g. `PostViews.card`, `PostViews.detail`) instead of a `?select=` parameter. Views are parsed at the controller layer.

**Case conversion** — code is camelCase end to end (Drizzle column TS props, Zod DTOs, services). `ResponseInterceptorV2` converts the response `data`/`meta` to snake_case at the wire boundary (`transformResponseCase` in `src/common/response/case-transform.ts`); the wire format stays snake_case. DB column names are unchanged — each Drizzle column keeps its explicit snake_case name string. Never call a manual `snakeCaseKeys`-style helper in a controller.

**`@BypassCaseTransform([paths])`** — opt a field subtree out of snake_case conversion (free-form JSON columns, snippet payloads). Paths root at `data`, dotted segments, `[]` marks an array level (e.g. `'items[].rawPayload'`). Located in `src/common/response/bypass-case-transform.decorator.ts`.

**`@RawResponse`** — opt out of the whole envelope + casing pipeline for non-JSON responses (streams, HTML, RSS, redirects). Located in `src/common/response/raw-response.decorator.ts`.

**Writing a new endpoint:**
1. Return `{ data: <value> }` or `{ data: <value>, meta: new MetaObjectBuilder()...build() }`.
2. Throw `AppException` subclasses (or `BizException` with an `ErrorCodeEnum` code) for errors.
3. Use `@RawResponse` only if the response is not JSON.
4. Define or reuse a view in `<resource>.views.ts` and parse through it before returning.

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

**Release-phase migration**: schema migrations run as a one-shot pre-deploy step, NOT on app startup. The app boot guard (`assertSchemaCurrent` in `processors/database/postgres.provider.ts`) refuses to start if the schema is behind. Run via `pnpm -C apps/core run migrate` locally or via the `mx-migrate` service in compose.

When authoring or reviewing a migration, use the `mx-migration-author` skill — it enforces expand-contract for rolling deploys (Dokploy 2 replicas). CI runs `pnpm -C apps/core run lint:migrations` to flag dangerous patterns. Full design: `docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md`.

## Configuration

Configuration via `src/app.config.ts` supports:
- Environment variables
- Command line arguments
- YAML configuration files
