---
name: api-conventions
description: MX Space API design conventions. Apply when writing controllers, API endpoints, or handling HTTP requests.
user-invocable: false
---

# MX Space API Design Conventions

## Controller Decorators

```typescript
// Use @ApiController instead of @Controller
// Dev environment has no prefix, production auto-adds /api/v{version} prefix
@ApiController('posts')  // ✓
@Controller('posts')     // ✗
```

## Authentication

```typescript
// Endpoints requiring login
@Auth()
async create() {}

// Optional auth (get current user status)
async get(@IsAuthenticated() isAuth: boolean) {}

// Get current user
async get(@CurrentUser() user: UserModel) {}
```

## Response Transformation

`ResponseInterceptor` (global `APP_INTERCEPTOR`) wraps every controller return value:

| Return value | Emitted |
|-------------|-------------------|
| bare value `T` | `{ data: T }` |
| `withMeta(data, meta)` | `{ data, meta }` |
| `undefined` | 204 No Content |
| `@HTTPDecorators.RawResponse` | untouched — skips envelope and case conversion |

`withMeta` (from `~/common/response/envelope.types`) is detected by an internal `Symbol`,
**not** by the presence of a `data` key — returning an object literal whose top-level keys
include `data` gets double-wrapped. CI enforces this via
`scripts/check-controller-response-envelope.ts`.

`transformResponseCase` (`~/common/response/case-transform.ts`) converts the response
`data`/`meta` to snake_case at the wire boundary:
- `createdAt` → `created_at`
- `categoryId` → `category_id`

Opt a field subtree out with `@BypassCaseTransform(['items[].rawPayload'])`.

## Pagination

Pagination belongs in `meta`, never merged into `data`. Build it with `MetaObjectBuilder`:

```typescript
@Get('/')
async list(@Query() query: PagerDto) {
  const result = await this.postRepository.list({
    page: query.page,
    size: query.size,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  })

  const metaBuilder = new MetaObjectBuilder().view('card').pagination({
    page: result.pagination.currentPage,
    size: result.pagination.size,
    total: result.pagination.total,
    totalPages: result.pagination.totalPage,
  })

  return withMeta(result.data, metaBuilder.build())
}
```

For CRUD boilerplate, use `BasePgCrudFactory`:

```typescript
@ApiController(paths)
export class LinkControllerCrud extends BasePgCrudFactory({
  repository: LinkRepository,
}) {
  @Get('/')
  async gets(@Query() pager: PagerDto) {
    const { size = 10, page = 1 } = pager
    return this.repository.list(page, size)
  }
}
```

## Parameter Validation

```typescript
// Path parameters — use EntityIdDto for Snowflake entity IDs
@Get('/:id')
async get(@Param() params: EntityIdDto) {
  return this.service.findById(params.id)
}

// For integer IDs or entity IDs (e.g. notes with nid)
@Get('/:id')
async get(@Param() params: IntIdOrEntityIdDto) {}

// Query parameters
@Get('/')
async list(@Query() query: PagerDto) {}

// Request body
@Post('/')
async create(@Body() body: CreateDto) {}
```

## HTTP Methods

| Method | Purpose | Status Code |
|--------|---------|-------------|
| GET | Retrieve resource | 200 |
| POST | Create resource | 201 |
| PUT | Full update | 200 |
| PATCH | Partial update | 200 |
| DELETE | Delete resource | 204 |

## Error Handling

```typescript
import { BusinessException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'

// Business errors
throw new BusinessException(ErrorCodeEnum.PostNotFound)
throw new BusinessException(ErrorCodeEnum.SlugNotAvailable, slug)

// HTTP errors
throw new BadRequestException('Invalid input')
throw new NotFoundException('Resource not found')
throw new UnauthorizedException('Not logged in')
```

## Idempotency

```typescript
// Add idempotency protection for create operations
@Post('/')
@HTTPDecorators.Idempotence()
async create() {}

// Custom idempotency key
@HTTPDecorators.Idempotence({ key: 'custom-key' })
```

## Caching

```typescript
// Disable cache
@Get('/')
@HttpCache.disable
async list() {}

// Custom cache
@HttpCache({ ttl: 60, key: 'my-key' })
async get() {}
```
