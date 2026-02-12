---
name: create-e2e-test
description: Create E2E test file for a specified module. Use when adding end-to-end tests for controllers.
argument-hint: <module-name>
disable-model-invocation: true
---

# Create E2E Test

Create E2E test file for a module. Module name: `$ARGUMENTS`

## Test File Location

Create file: `apps/core/test/src/modules/<module-name>/<module-name>.controller.e2e-spec.ts`

## E2E Test Template

```typescript
import { describe, expect, it, afterAll } from 'vitest'
import type { MongooseModel } from '~/shared/types/mongoose.types'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'

// Import module under test
import { <Name>Controller } from '~/modules/<name>/<name>.controller'
import { <Name>Service } from '~/modules/<name>/<name>.service'
import { <Name>Model } from '~/modules/<name>/<name>.model'

// Mock data
const mockData = [
  {
    name: 'Test Item 1',
    // ... other fields
  },
  {
    name: 'Test Item 2',
    // ... other fields
  },
]

describe('<Name>Controller (e2e)', async () => {
  let model: MongooseModel<<Name>Model>

  const proxy = createE2EApp({
    controllers: [<Name>Controller],
    providers: [
      <Name>Service,
      // Add other required providers
    ],
    models: [
      <Name>Model,
      // Add other required models
    ],
    async pourData(modelMap) {
      const { model: _model } = modelMap.get(<Name>Model)!
      model = _model

      // Insert test data
      for (const data of mockData) {
        await _model.create(data)
      }
    },
  })

  afterAll(async () => {
    await model.deleteMany({})
  })

  describe('GET /<name>s', () => {
    it('should return paginated list', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/<name>s`,
      })

      expect(res.statusCode).toBe(200)
      const json = res.json()
      expect(json).toMatchObject({
        data: expect.any(Array),
        pagination: expect.objectContaining({
          total: expect.any(Number),
          current_page: expect.any(Number),
        }),
      })
    })
  })

  describe('GET /<name>s/:id', () => {
    it('should return single item by id', async () => {
      const item = await model.findOne()
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/<name>s/${item!._id}`,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        name: item!.name,
      })
    })

    it('should return 400 for invalid id', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/<name>s/invalid-id`,
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /<name>s', () => {
    it('should create new item', async () => {
      const newItem = {
        name: 'New Test Item',
        // ... other required fields
      }

      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/<name>s`,
        payload: newItem,
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({
        name: newItem.name,
      })
    })

    it('should return 400 for invalid data', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/<name>s`,
        payload: {}, // Missing required fields
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('PUT /<name>s/:id', () => {
    it('should update item', async () => {
      const item = await model.findOne()
      const updateData = { name: 'Updated Name' }

      const res = await proxy.app.inject({
        method: 'PUT',
        url: `${apiRoutePrefix}/<name>s/${item!._id}`,
        payload: updateData,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        name: updateData.name,
      })
    })
  })

  describe('DELETE /<name>s/:id', () => {
    it('should delete item', async () => {
      const item = await model.create({ name: 'To Delete' })

      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/<name>s/${item._id}`,
      })

      expect(res.statusCode).toBe(204)

      const deleted = await model.findById(item._id)
      expect(deleted).toBeNull()
    })
  })
})
```

## Test Helpers

### Database Mock

```typescript
import { dbHelper } from 'test/helper/db-mock.helper'

// Get model instance
const model = dbHelper.getModel(MyModel)
```

### Redis Mock

```typescript
import { redisHelper } from 'test/helper/redis-mock.helper'

// Automatically handled in createE2EApp
```

### Auth Mock

In tests, the `@Auth()` decorator is mocked - all requests are treated as authenticated.
To test unauthenticated scenarios, use the real AuthGuard.

## Running Tests

```bash
# Run single test file
pnpm test -- test/src/modules/<name>/<name>.controller.e2e-spec.ts

# Run all tests
pnpm test

# Watch mode
pnpm -C apps/core run test:watch
```

## Notes

1. Test data is created in `pourData` and cleaned up in `afterAll`
2. Use `proxy.app.inject()` to send HTTP requests
3. Responses go through `JSONTransformInterceptor`, field names are snake_case
4. Paginated responses include `data` and `pagination` fields
5. Empty responses return 204 status code
