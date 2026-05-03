import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import {
  LinkController,
  LinkControllerCrud,
} from '~/modules/link/link.controller'
import { LinkRepository } from '~/modules/link/link.repository'
import { LinkService } from '~/modules/link/link.service'
import { LinkState, LinkType } from '~/modules/link/link.types'

import { assertNoLegacyKeys, assertPgTimestamps } from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { eventEmitterProvider } from '../../mock/processors/event.mock'

const fixtureLink = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000050',
  name: 'a friend',
  url: 'https://example.com',
  avatar: null,
  description: null,
  type: LinkType.Friend,
  state: LinkState.Pass,
  email: 'redacted@example.com',
  hide: false,
  createdAt: new Date('2024-05-01T00:00:00.000Z'),
  modifiedAt: null,
  ...overrides,
})

const linkRepositoryProvider = {
  provide: LinkRepository,
  useValue: {
    async list(page = 1, size = 10) {
      return {
        data: [fixtureLink()],
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
    async findAvailable() {
      return [fixtureLink()]
    },
    async findById() {
      return fixtureLink()
    },
    async findAll() {
      return [fixtureLink()]
    },
    async create(input: any) {
      return fixtureLink(input)
    },
    async update(id: any, patch: any) {
      return fixtureLink({ id, ...patch })
    },
    async deleteById() {
      return fixtureLink()
    },
  },
}

const linkServiceProvider = {
  provide: LinkService,
  useValue: {
    async canApplyLink() {
      return true
    },
  },
}

describe('LinkController contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [LinkControllerCrud, LinkController],
    providers: [
      linkRepositoryProvider,
      linkServiceProvider,
      ...eventEmitterProvider,
    ],
  })

  test('GET /links — list, no legacy keys, PG timestamps', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/links`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
  })

  test('GET /links/all — public friend list, no email leakage, no legacy keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/links/all`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    assertNoLegacyKeys(body)
    assertPgTimestamps(body.data[0])
    // public callers must not see contact emails.
    expect(body.data[0].email).toBeNull()
  })

  test('GET /links/audit — application gate flag', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/links/audit`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    assertNoLegacyKeys(body)
    expect(typeof body.can).toBe('boolean')
  })
})
