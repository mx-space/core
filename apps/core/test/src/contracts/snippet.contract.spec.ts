import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetService } from '~/modules/snippet/snippet.service'

import { assertNoLegacyKeys } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const fixtureObject = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000070',
  path: 'pkg/demo.json',
  type: 'json',
  enable: true,
  private: false,
  method: null,
  comment: null,
  updatedAt: new Date('2024-07-01T00:00:00.000Z'),
  ...overrides,
})

const snippetServiceProvider = {
  provide: SnippetService,
  useValue: {
    repository: {
      async findAnyByPath() {
        return { ...fixtureObject(), raw: '{}', createdAt: new Date() }
      },
    },
    listVfs() {
      return {
        prefix: '',
        objects: [fixtureObject()],
        commonPrefixes: ['pkg/'],
      }
    },
    transformLeanSnippet<T>(row: T): T {
      return row
    },
  },
}

describe('SnippetController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [SnippetController],
    providers: [snippetServiceProvider],
  })

  test('GET /snippets — VFS list, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/snippets`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data.objects)).toBe(true)
    expect(body.data.objects[0].path).toBe('pkg/demo.json')
    assertNoLegacyKeys(body)
  })

  test('GET /snippets/by-path — path lookup, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/snippets/by-path?path=pkg/demo.json`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.path).toBe('pkg/demo.json')
    assertNoLegacyKeys(body)
  })
})
