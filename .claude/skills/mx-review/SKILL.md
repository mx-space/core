---
name: mx-review
description: Review code for MX Space project conventions. Checks NestJS patterns, TypeGoose models, Zod schemas, API design, etc.
argument-hint: [file-path]
---

# MX Space Code Review

Review code for project conventions. Target: `$ARGUMENTS`

## Review Checklist

### 1. Controller Conventions

- [ ] Uses `@ApiController()` instead of `@Controller()`
- [ ] Paginated endpoints use `@HTTPDecorators.Paginator`
- [ ] Authenticated endpoints use `@Auth()` decorator
- [ ] Uses correct HTTP methods (GET/POST/PUT/DELETE)
- [ ] Parameter validation uses DTOs
- [ ] Return values follow response conventions (arrays auto-wrapped, objects returned directly)

### 2. Service Conventions

- [ ] Uses `@InjectModel()` to inject models
- [ ] Queries use `.lean()` for plain objects
- [ ] Complex queries use aggregation pipelines
- [ ] Circular dependencies resolved with `ModuleRef`
- [ ] Async tasks use `scheduleManager.schedule()`
- [ ] Events use `eventManager.emit()` or `eventManager.broadcast()`

### 3. Model Conventions

- [ ] Extends from `BaseModel` or `WriteBaseModel`
- [ ] Uses `@modelOptions()` to configure collection name
- [ ] Required fields have indexes (`@index()`)
- [ ] Reference fields use `@prop({ ref: () => Model })`
- [ ] Defines `protectedKeys` for sensitive fields

### 4. Schema (DTO) Conventions

- [ ] Uses Zod instead of class-validator
- [ ] Uses `createZodDto()` to create DTO classes
- [ ] Provides Partial DTO for update operations
- [ ] Uses project custom validators (e.g., `zMongoId`, `zNonEmptyString`)

### 5. API Design Conventions

- [ ] RESTful naming (plural nouns)
- [ ] Correct status codes (200/201/204/400/401/404)
- [ ] Paginated responses include `data` and `pagination`
- [ ] Error responses use `BusinessException`

### 6. Test Conventions

- [ ] Controllers have corresponding E2E tests
- [ ] Services have corresponding unit tests
- [ ] Uses `createE2EApp` to create test app
- [ ] Test data created in `pourData`
- [ ] Data cleaned up after tests

### 7. Security Conventions

- [ ] Sensitive operations protected by `@Auth()`
- [ ] User input is validated
- [ ] Internal error details not exposed
- [ ] Sensitive info not logged

### 8. Performance Conventions

- [ ] Uses `.lean()` to reduce memory usage
- [ ] Batch operations use `Promise.all`
- [ ] Large datasets use cursor iteration
- [ ] Hot queries have caching

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

### Issue 2: Not using lean()

```typescript
// Wrong - returns Mongoose Document
return this.model.find()

// Correct - returns plain object
return this.model.find().lean()
```

### Issue 3: Response not following conventions

```typescript
// Wrong - manually wrapping array
return { data: items }

// Correct - ResponseInterceptor auto-wraps
return items
```

### Issue 4: Circular Dependency

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
