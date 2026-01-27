# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MX Space is a personal blog server application built with NestJS, MongoDB, and Redis. This is a monorepo containing the core server application and related packages. The main application is located in `apps/core/`.

## Related Projects

- **Dashboard (admin-vue3)**: `../admin-vue3` - 后台管理面板，Vue 3 项目
- **Frontend (shiroi)**: `../shiroi` - 主站前端

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
- `database/` - MongoDB connection and model registration
- `redis/` - Redis caching and pub/sub
- `gateway/` - WebSocket gateways for real-time features
- `helper/` - Utility services (email, image, JWT, etc.)

**Database Models**: Uses Mongoose with TypeGoose. All models extend a base with `_id`, `created`, `updated` fields.

**Authentication**: JWT-based with decorators `@Auth()` for route protection and `@CurrentUser()` for accessing the authenticated user.

## API Response Rules

`ResponseInterceptor` auto-wraps responses:
- **Array** → `{ data: [...] }` (always wrapped)
- **Object** → returned directly (no wrapper)
- **@Paginator** → `{ data: [...], pagination: {...} }` (requires `model.paginate()` result)
- **@Bypass** → skips all transformation

`JSONTransformInterceptor` converts all keys to **snake_case** (e.g., `createdAt` → `created_at`)

## Testing

Uses Vitest with in-memory MongoDB and Redis.

### E2E Test Pattern
Use `createE2EApp` helper from `test/helper/create-e2e-app.ts`:
```typescript
const proxy = createE2EApp({
  imports: [...],
  controllers: [MyController],
  providers: [...],
  models: [MyModel],
  pourData: async (modelMap) => {
    // Insert test data
    const model = modelMap.get(MyModel)!.model
    await model.create({ ... })
  }
})

it('should work', async () => {
  const res = await proxy.app.inject({ method: 'GET', url: '/...' })
  expect(res.statusCode).toBe(200)
})
```

### Test Mocks
- `test/mock/modules/` - Module-level mocks (auth, redis, gateway)
- `test/mock/processors/` - Processor mocks (email, event)
- `test/helper/` - Test utilities (db-mock, redis-mock)

## Database Migrations

Migration scripts in `src/migration/version/` are version-based and run automatically on startup when needed.

## Configuration

Configuration via `src/app.config.ts` supports:
- Environment variables
- Command line arguments
- YAML configuration files
