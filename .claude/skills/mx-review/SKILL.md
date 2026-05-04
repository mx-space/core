---
name: mx-review
description: Review code for MX Space project conventions. Checks NestJS patterns, Drizzle ORM repositories, Zod schemas, API design, etc.
argument-hint: [file-path]
---

# MX Space Code Review

Review code for project conventions. Target: `$ARGUMENTS`

## Review Checklist

### 1. Controller Conventions

- [ ] Uses `@ApiController()` instead of `@Controller()`
- [ ] Paginated endpoints return `PaginationResult<T>` from repository (no special decorator needed)
- [ ] Authenticated endpoints use `@Auth()` decorator
- [ ] Uses correct HTTP methods (GET/POST/PUT/DELETE)
- [ ] Parameter validation uses DTOs (e.g., `EntityIdDto` for path params)
- [ ] Return values follow response conventions (arrays auto-wrapped, objects returned directly)

### 2. Service Conventions

- [ ] Injects repository class directly (e.g., `private readonly postRepository: PostRepository`)
- [ ] Circular dependencies resolved with `ModuleRef` and injection tokens
- [ ] Async tasks use `scheduleManager.schedule()`
- [ ] Events use `eventManager.emit()` or `eventManager.broadcast()`

### 3. Repository Conventions

- [ ] Extends `BaseRepository` from `~/processors/database/base.repository`
- [ ] Uses `@Inject(PG_DB_TOKEN) db: AppDatabase` constructor parameter
- [ ] Uses Drizzle query builder (`this.db.select().from(table).where(...)`)
- [ ] ID boundaries validated with `parseEntityId()` / `toEntityId()` / `toDbId()`
- [ ] Pagination uses `this.paginationOf(total, page, size)` helper from `BaseRepository`
- [ ] Returns `PaginationResult<T>` for paginated queries

### 4. Schema (DTO) Conventions

- [ ] Uses Zod instead of class-validator
- [ ] Uses `createZodDto()` to create DTO classes
- [ ] Provides Partial DTO for update operations
- [ ] Uses project custom validators (e.g., `zEntityId`, `zNonEmptyString`, `zCoerceInt`)

### 5. Database Schema Conventions

- [ ] Uses Drizzle `pgTable()` in `~/database/schema/`
- [ ] Primary keys use `pkText()` helper (Snowflake text IDs)
- [ ] Foreign keys use `refText()` helper
- [ ] Timestamps use `createdAt()`, `updatedAt()`, or `tsCol()` helpers
- [ ] Indexes defined in the third argument of `pgTable()`

### 6. API Design Conventions

- [ ] RESTful naming (plural nouns)
- [ ] Correct status codes (200/201/204/400/401/404)
- [ ] Paginated responses include `data` and `pagination`
- [ ] Error responses use `BusinessException`

### 7. Module Registration Conventions

- [ ] Repository registered as provider in module
- [ ] Service and controller registered in module
- [ ] Cross-module access uses injection tokens (e.g., `POST_SERVICE_TOKEN`)
- [ ] Global modules decorated with `@Global()`

### 8. Test Conventions

- [ ] Controllers have corresponding E2E tests
- [ ] Uses `createE2EApp` to create test app
- [ ] Test data created in `pourData`

### 9. Security Conventions

- [ ] Sensitive operations protected by `@Auth()`
- [ ] User input is validated
- [ ] Internal error details not exposed
- [ ] Sensitive info not logged

### 10. Performance Conventions

- [ ] Batch operations use `Promise.all`
- [ ] Large datasets use cursor-based pagination (`OffsetDto` with `before`/`after`)
- [ ] Hot queries have caching
- [ ] Avoid N+1 queries — batch related lookups (e.g., `attachCategory`, `attachRelated`)

## Common Issues

### Issue 1: Using class-validator

```typescript
// Wrong
import { IsString } from 'class-validator'
class CreateDto {
  @IsString()
  name: string
}

// Correct
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
const Schema = z.object({ name: z.string() })
class CreateDto extends createZodDto(Schema) {}
```

### Issue 2: Response not following conventions

```typescript
// Wrong - manually wrapping array
return { data: items }

// Correct - ResponseInterceptor auto-wraps
return items
```

### Issue 3: Circular Dependency

```typescript
// Wrong - direct injection causes circular dependency
constructor(private readonly otherService: OtherService) {}

// Correct - use ModuleRef for lazy loading
private otherService: OtherService
constructor(private readonly moduleRef: ModuleRef) {}
onApplicationBootstrap() {
  this.otherService = this.moduleRef.get(OTHER_SERVICE_TOKEN, { strict: false })
}
```

### Issue 4: Not using EntityIdDto for path params

```typescript
// Wrong - raw string param with no validation
@Get('/:id')
async get(@Param('id') id: string) {}

// Correct - validated entity ID
@Get('/:id')
async get(@Param() params: EntityIdDto) {
  return this.service.findById(params.id)
}
```

### Issue 5: Repository not validating ID boundaries

```typescript
// Wrong - passing raw string to DB query
await this.db.select().from(posts).where(eq(posts.id, id))

// Correct - validate ID at repository boundary
const idBig = parseEntityId(id)
await this.db.select().from(posts).where(eq(posts.id, idBig))
```

## Output Format

After review, output in the following format:

```
## Review Results

### Passed
- [x] Item 1
- [x] Item 2

### Needs Changes
- [ ] Issue description
  - Location: `file:line`
  - Suggestion: Change recommendation

### Optimization Suggestions
- Suggestion 1
- Suggestion 2
```
