---
name: create-module
description: Create a new NestJS module with repository, service, controller, schema, and Drizzle table definition. Use when adding new feature modules, API endpoints, or business domains.
argument-hint: <module-name>
disable-model-invocation: true
---

# Create NestJS Module (PostgreSQL / Drizzle)

Create a new NestJS module for MX Space project. Module name: `$ARGUMENTS`

## Directory Structure

Create the following files under `apps/core/src/modules/<module-name>/`:

```
<module-name>/
├── <name>.module.ts       # Module definition
├── <name>.controller.ts   # HTTP controller
├── <name>.service.ts      # Business logic
├── <name>.repository.ts   # Drizzle repository (extends BaseRepository)
├── <name>.schema.ts       # Zod validation schemas for API DTOs
├── <name>.types.ts        # TypeScript row/input types
└── <name>.enum.ts         # Enums (optional, only if needed)
```

Also add the Drizzle table definition in `apps/core/src/database/schema/`.

## File Templates

### 0. Drizzle Table (`database/schema/<name>.ts`)

Create a new schema file (or append to an existing one) in `apps/core/src/database/schema/`.

```typescript
import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

import { createdAt, pkText, refText, tsCol, updatedAt } from './columns'

export const <name>s = pgTable(
  '<name>s',
  {
    id: pkText(),
    createdAt: createdAt(),
    name: text('name').notNull(),
    // Add other columns...
  },
  (table) => [
    // Add indexes and unique constraints
    // uniqueIndex('<name>s_name_uniq').on(table.name),
    // index('<name>s_created_at_idx').on(table.createdAt),
  ],
)
```

Then re-export it from `apps/core/src/database/schema/index.ts`:

```typescript
export * from './<name>'
```

**Column helpers** (from `columns.ts`):

- `pkText()` — Snowflake primary key as text (auto-named `id`)
- `refText(name)` — Snowflake foreign-key reference as text
- `createdAt()` — `created_at` timestamp with default `now()`
- `updatedAt()` — `updated_at` nullable timestamp
- `tsCol(name)` — generic timestamp column

**Common column types**:

- `text('col')` — string
- `integer('col')` — number
- `boolean('col')` — boolean (use `.default(false)`)
- `jsonb('col').$type<T>()` — JSON data
- `text('col').array()` — text array (e.g., tags)

### 1. Types (`<name>.types.ts`)

```typescript
import type { EntityId } from '~/shared/id/entity-id'

export interface <Name>Row {
  id: EntityId
  name: string
  createdAt: Date
}

export interface <Name>CreateInput {
  name: string
}

export type <Name>PatchInput = Partial<<Name>CreateInput>
```

### 2. Repository (`<name>.repository.ts`)

```typescript
import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { <name>s } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { <Name>CreateInput, <Name>PatchInput, <Name>Row } from './<name>.types'

const mapRow = (row: typeof <name>s.$inferSelect): <Name>Row => ({
  id: toEntityId(row.id) as EntityId,
  name: row.name,
  createdAt: row.createdAt,
})

@Injectable()
export class <Name>Repository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(
    page = 1,
    size = 10,
    filter?: Record<string, unknown>,
  ): Promise<PaginationResult<<Name>Row>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(<name>s)
        .orderBy(desc(<name>s.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(<name>s),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findAll(): Promise<<Name>Row[]> {
    const rows = await this.db
      .select()
      .from(<name>s)
      .orderBy(desc(<name>s.createdAt))
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<<Name>Row | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(<name>s)
      .where(eq(<name>s.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: <Name>CreateInput): Promise<<Name>Row> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(<name>s)
      .values({
        id,
        name: input.name,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: <Name>PatchInput,
  ): Promise<<Name>Row | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof <name>s.$inferInsert> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (Object.keys(update).length === 0) {
      const [existing] = await this.db
        .select()
        .from(<name>s)
        .where(eq(<name>s.id, idBig))
        .limit(1)
      return existing ? mapRow(existing) : null
    }
    const [row] = await this.db
      .update(<name>s)
      .set(update)
      .where(eq(<name>s.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<<Name>Row | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(<name>s)
      .where(eq(<name>s.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(<name>s)
    return Number(row?.count ?? 0)
  }
}
```

**Key patterns**:

- Inject `PG_DB_TOKEN` (the Drizzle `AppDatabase` instance) and `SnowflakeService`
- Use `parseEntityId(id)` to validate incoming Snowflake IDs before queries
- Use `toEntityId(row.id)` when mapping rows out of the repository
- Use `this.snowflake.nextId()` to generate new Snowflake IDs on insert
- Use `.returning()` on insert/update/delete to get the affected row back

### 3. Service (`<name>.service.ts`)

```typescript
import { Injectable } from '@nestjs/common'

import { <Name>Repository } from './<name>.repository'

@Injectable()
export class <Name>Service {
  constructor(private readonly <name>Repository: <Name>Repository) {}

  public get repository() {
    return this.<name>Repository
  }

  // Add business logic methods here.
  // Simple CRUD is delegated to the repository.
  // Cross-module orchestration, validation, and events go in the service.
}
```

### 4. Schema / DTOs (`<name>.schema.ts`)

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zNonEmptyString } from '~/common/zod'

export const <Name>Schema = z.object({
  name: zNonEmptyString,
  // Add other fields...
})

export class <Name>Dto extends createZodDto(<Name>Schema) {}

export const Partial<Name>Schema = <Name>Schema.partial()

export class Partial<Name>Dto extends createZodDto(Partial<Name>Schema) {}

// Type exports
export type <Name>Input = z.infer<typeof <Name>Schema>
export type Partial<Name>Input = z.infer<typeof Partial<Name>Schema>
```

**ID validation**: Use `EntityIdDto` from `~/shared/dto/id.dto` for route params:

```typescript
import { EntityIdDto } from '~/shared/dto/id.dto'
// In controller: @Param() params: EntityIdDto
// Access: params.id  (validated Snowflake string)
```

**Common zod primitives** (from `~/common/zod`):

- `zNonEmptyString` — `z.string().min(1)`
- `zCoerceBoolean` — coerces string `"true"`/`"1"` to boolean
- `zCoerceInt` / `zCoercePositiveInt` — coerced number validators
- `zPaginationPage` / `zPaginationSize` — pagination defaults
- `zEntityId` — validates Snowflake string format
- `zHttpsUrl` — HTTPS URL validator
- `zEmail(msg)` — email validator with message

### 5. Controller (`<name>.controller.ts`)

**Option A: Manual controller** (for custom routes and logic):

```typescript
import { Body, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { <Name>Service } from './<name>.service'
import { <Name>Dto, Partial<Name>Dto } from './<name>.schema'

@ApiController('<name>s')
export class <Name>Controller {
  constructor(private readonly <name>Service: <Name>Service) {}

  @Get('/')
  async getPaginate(@Query() query: PagerDto) {
    const { page, size } = query
    return this.<name>Service.repository.list(page, size)
  }

  @Get('/all')
  async getAll() {
    return this.<name>Service.repository.findAll()
  }

  @Get('/:id')
  async getById(@Param() params: EntityIdDto) {
    return this.<name>Service.repository.findById(params.id)
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: <Name>Dto) {
    return this.<name>Service.repository.create(body)
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: EntityIdDto, @Body() body: <Name>Dto) {
    return this.<name>Service.repository.update(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async delete(@Param() params: EntityIdDto) {
    await this.<name>Service.repository.deleteById(params.id)
  }
}
```

**Option B: Auto-CRUD via `BasePgCrudFactory`** (for simple CRUD modules):

```typescript
import { Get, Query } from '@nestjs/common'

import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'
import { PagerDto } from '~/shared/dto/pager.dto'

import { <Name>Repository } from './<name>.repository'

export class <Name>Controller extends BasePgCrudFactory({
  repository: <Name>Repository,
}) {
  // inherits GET /, GET /all, GET /:id, POST /, PUT /:id, PATCH /:id, DELETE /:id
  // add custom routes here
}
```

### 6. Module (`<name>.module.ts`)

```typescript
import { Module } from '@nestjs/common'

import { <Name>Controller } from './<name>.controller'
import { <Name>Repository } from './<name>.repository'
import { <Name>Service } from './<name>.service'

@Module({
  controllers: [<Name>Controller],
  providers: [<Name>Service, <Name>Repository],
  exports: [<Name>Service, <Name>Repository],
})
export class <Name>Module {}
```

If the module needs to be globally available (used by many other modules), add `@Global()`:

```typescript
import { Global, Module } from '@nestjs/common'
// ...
@Global()
@Module({ /* ... */ })
export class <Name>Module {}
```

## Register Module

After creating files, register the module in `apps/core/src/app.module.ts`:

1. Add import statement for `<Name>Module`
2. Add `<Name>Module` to the `imports` array

## Register Repository Token (if needed for cross-module DI)

If other modules need to inject the repository by token, add an entry in `apps/core/src/processors/database/repository.tokens.ts`:

```typescript
export const POSTGRES_REPOSITORY_TOKENS = {
  // ... existing tokens
  <name>: Symbol('<Name>Repository'),
} as const
```

Then provide it in the module:

```typescript
{
  provide: POSTGRES_REPOSITORY_TOKENS.<name>,
  useExisting: <Name>Repository,
}
```

## Generate Schema Migration

After adding the Drizzle table definition, generate a SQL migration:

```bash
pnpm drizzle-kit generate    # Run from apps/core/ directory
```

This creates a new numbered SQL file in `apps/core/src/database/migrations/`.

## Project Conventions

- Use `@ApiController()` instead of `@Controller()` — adds `/api/v2` prefix in production
- IDs are **Snowflake strings** (not MongoDB ObjectIds). Validate with `zEntityId` / `EntityIdDto`
- Schema defined in `database/schema/` using Drizzle `pgTable()`
- Repositories extend `BaseRepository` and inject `PG_DB_TOKEN` + `SnowflakeService`
- Use Zod schemas for request validation, not class-validator
- Use `@Auth()` decorator for authenticated endpoints
- Use `@HTTPDecorators.Paginator` or `PagerDto` for paginated endpoints
- Use `@HTTPDecorators.Idempotence()` for POST endpoints to prevent duplicates
- Response keys are auto-converted to snake_case by `JSONTransformInterceptor`
