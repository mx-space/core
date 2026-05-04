import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetService } from '~/modules/snippet/snippet.service'

import { assertNoLegacyKeys, assertPgTimestamps } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const fixtureSnippet = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000070',
  name: 'demo',
  reference: 'pkg',
  type: 'json',
  raw: '{}',
  enable: true,
  private: false,
  method: 'GET',
  metadata: null,
  comments: '',
  createdAt: new Date('2024-07-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const snippetServiceProvider = {
  provide: SnippetService,
  useValue: {
    repository: {
      async list(page = 1, size = 10) {
        return {
          data: [fixtureSnippet()],
          pagination: {
            total: 1,
            currentPage: page,
            totalPage: 1,
            size,
            hasNextPage: false,
            hasPrevPage: false,
          },
        }
      },
      async listGrouped(page = 1, size = 30) {
        return {
          data: [{ reference: 'pkg', snippets: [fixtureSnippet()] }],
          pagination: {
            total: 1,
            currentPage: page,
            totalPage: 1,
            size,
            hasNextPage: false,
            hasPrevPage: false,
          },
        }
      },
      async findAll() {
        return [fixtureSnippet()]
      },
    },
    transformLeanSnippetList<T>(rows: T[]): T[] {
      return rows
    },
  },
}

describe('SnippetController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [SnippetController],
    providers: [snippetServiceProvider],
  })

  test('GET /snippets — admin list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/snippets`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /snippets/group — grouped list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/snippets/group`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
  })

  test('GET /snippets/group/:reference — by reference, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/snippets/group/pkg`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })
})
