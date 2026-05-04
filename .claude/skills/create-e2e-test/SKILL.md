---
name: create-e2e-test
description: Create E2E test file for a specified module. Use when adding end-to-end tests for controllers or unit tests for services and repositories.
argument-hint: <module-name>
disable-model-invocation: true
---

# Create Test

Create test file for a module. Module name: `$ARGUMENTS`

## Test File Locations

- Controller/service tests: `apps/core/test/src/modules/<module-name>/<module-name>.controller.spec.ts`
- Repository tests (with real PG): `apps/core/test/src/modules/<module-name>/<module-name>.repository.spec.ts`

## Test Pattern 1: Unit Test with Mocked Dependencies

For testing controllers, services, or business logic without a real database:

```typescript
import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { <Name>Controller } from '~/modules/<name>/<name>.controller'
import { <Name>Service } from '~/modules/<name>/<name>.service'

describe('<Name>Controller', () => {
  let controller: <Name>Controller

  const mock<Name>Service = {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    const module = await Test.createTestingModule({
      controllers: [<Name>Controller],
      providers: [
        {
          provide: <Name>Service,
          useValue: mock<Name>Service,
        },
      ],
    }).compile()

    controller = module.get(<Name>Controller)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('calls service.findById with the correct id', async () => {
    const mockRow = { id: '1234567890', name: 'Test', createdAt: new Date() }
    mock<Name>Service.findById.mockResolvedValue(mockRow)

    const result = await controller.getById({ id: '1234567890' })
    expect(mock<Name>Service.findById).toHaveBeenCalledWith('1234567890')
    expect(result).toEqual(mockRow)
  })
})
```

## Test Pattern 2: E2E Test with `createE2EApp`

For testing controllers through the full HTTP pipeline (with mocked DB):

```typescript
import { describe, expect, it } from 'vitest'

import { <Name>Controller } from '~/modules/<name>/<name>.controller'
import { <Name>Service } from '~/modules/<name>/<name>.service'
import { <Name>Repository } from '~/modules/<name>/<name>.repository'
import { createE2EApp } from 'test/helper/create-e2e-app'

describe('<Name>Controller (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [<Name>Controller],
    providers: [<Name>Service, <Name>Repository],
  })

  it('GET /<name>s returns paginated list', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/<name>s',
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    // ResponseInterceptor wraps arrays as { data: [...] }
    // Paginated responses include { data: [...], pagination: {...} }
  })

  it('GET /<name>s/:id returns single item', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/<name>s/invalid-id',
    })

    // Invalid Snowflake IDs should return 400
    expect(res.statusCode).toBe(400)
  })
})
```

### `createE2EApp` Behavior

The `createE2EApp` helper (from `test/helper/create-e2e-app.ts`):

1. Sets up a NestJS testing module with your controllers and providers
2. Overrides `AuthGuard` with `AuthTestingGuard` — pass header `'test-token': 1` for authenticated requests
3. Registers all standard interceptors (`ResponseInterceptor`, `JSONTransformInterceptor`, `DbQueryInterceptor`, `HttpCacheInterceptor`)
4. Registers the global Zod validation pipe
5. Creates a Fastify-based Nest application
6. Returns `{ app }` — use `proxy.app.inject({ method, url, payload })` for HTTP requests
7. Automatically closes the app in `afterAll`

**Auth in tests**: All requests are treated as unauthenticated by default. To authenticate, pass the test header:

```typescript
const res = await proxy.app.inject({
  method: 'POST',
  url: '/<name>s',
  payload: { name: 'Test' },
  headers: { 'test-token': 1 }, // <-- authenticates as mock admin
})
```

## Test Pattern 3: Repository Test with Real PostgreSQL

For testing repository logic against a real database using testcontainers:

```typescript
import path from 'node:path'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest'

import { <name>s } from '~/database/schema'
import { <Name>Repository } from '~/modules/<name>/<name>.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

const verifyUrl = process.env.PG_VERIFY_URL
const describeIfPg = verifyUrl ? describe : describe.skip

describeIfPg('<Name>Repository', () => {
  let pool: Pool
  let db: NodePgDatabase<typeof import('~/database/schema')>
  let repository: <Name>Repository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    pool = new Pool({ connectionString: verifyUrl })
    db = drizzle(pool, { casing: 'snake_case' })
    const migrationsFolder = path.resolve(
      __dirname,
      '../../../../src/database/migrations',
    )
    await migrate(db, { migrationsFolder })
    snowflake = new SnowflakeService()
    repository = new <Name>Repository(db as any, snowflake)
  }, 60_000)

  beforeEach(async () => {
    // Truncate tables between tests (respect FK order)
    await pool.query('truncate table <name>s cascade')
  })

  afterAll(async () => {
    if (pool) await pool.end()
  })

  it('creates a row with a generated Snowflake id', async () => {
    const created = await repository.create({
      name: 'test',
    })
    expect(typeof created.id).toBe('string')
    expect(created.id).toMatch(/^[1-9]\d+$/) // Snowflake format
    expect(created.name).toBe('test')
  })

  it('findById returns null for missing id', async () => {
    const result = await repository.findById('9999999999999999999')
    expect(result).toBeNull()
  })

  it('update mutates only specified fields', async () => {
    const created = await repository.create({ name: 'old' })
    const updated = await repository.update(created.id, { name: 'new' })
    expect(updated?.name).toBe('new')
  })

  it('deleteById removes the row', async () => {
    const created = await repository.create({ name: 'to-delete' })
    await repository.deleteById(created.id)
    const found = await repository.findById(created.id)
    expect(found).toBeNull()
  })
})
```

### Running with Testcontainers

To run repository tests that need PostgreSQL, start a container first:

```bash
# Set PG_VERIFY_URL to a running PostgreSQL instance
export PG_VERIFY_URL=postgres://mx:mx@127.0.0.1:5432/mx_verify

# Or use docker:
docker run -d --name pg-test -e POSTGRES_USER=mx -e POSTGRES_PASSWORD=mx -e POSTGRES_DB=mx_verify -p 5433:5432 postgres:17-alpine
export PG_VERIFY_URL=postgres://mx:mx@127.0.0.1:5433/mx_verify
```

Then run the test:

```bash
# Run a single test file
pnpm test -- test/src/modules/<name>/<name>.repository.spec.ts

# Run all tests
pnpm test

# Watch mode
pnpm -C apps/core run test:watch
```

## Common Assertion Patterns

### HTTP Response Assertions

```typescript
// Status codes
expect(res.statusCode).toBe(200)
expect(res.statusCode).toBe(201)   // Created
expect(res.statusCode).toBe(204)   // No Content (deletes)
expect(res.statusCode).toBe(400)   // Validation error
expect(res.statusCode).toBe(404)   // Not found

// JSON body (auto snake_case via JSONTransformInterceptor)
const json = res.json()
expect(json).toMatchObject({ name: 'test' })

// Paginated response shape
expect(json).toMatchObject({
  data: expect.any(Array),
  pagination: expect.objectContaining({
    total: expect.any(Number),
    current_page: expect.any(Number),
    total_page: expect.any(Number),
  }),
})
```

### Snowflake ID Assertions

```typescript
// Valid Snowflake ID format
expect(created.id).toMatch(/^[1-9]\d+$/)
expect(typeof created.id).toBe('string')

// Invalid ID throws
await expect(repository.findById('not-an-id')).rejects.toThrow()
```

### Direct DB Inserts for Test Setup

When testing with a real database, use Drizzle directly to set up test data:

```typescript
await db.insert(<name>s).values([
  { id: snowflake.nextId(), name: 'Item 1' },
  { id: snowflake.nextId(), name: 'Item 2' },
])
```

## Test Helpers Location

- `test/helper/create-e2e-app.ts` — E2E app setup with mock auth and Redis
- `test/helper/setup-e2e.ts` — Low-level NestJS testing module setup
- `test/helper/pg-testcontainer.ts` — PostgreSQL 17 testcontainers helper
- `test/helper/redis-mock.helper.ts` — In-memory Redis mock
- `test/mock/guard/auth.guard.ts` — `AuthTestingGuard` (bypasses auth with `test-token` header)
- `test/mock/modules/` — Module-level mocks

## Notes

1. The `createE2EApp` helper uses mock Redis and bypasses auth. For real DB tests, use the repository test pattern.
2. Use `proxy.app.inject()` to send HTTP requests through the full interceptor chain.
3. Responses go through `JSONTransformInterceptor` — field names become snake_case.
4. Paginated responses include `data` and `pagination` fields.
5. Empty delete responses return 204 status code.
6. Repository tests with real PG are gated behind `process.env.PG_VERIFY_URL` — use `describeIfPg` / `describe.skip` pattern so they don't fail in CI without a database.
