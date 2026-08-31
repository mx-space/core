import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { DraftController } from '~/modules/draft/draft.controller'
import { DraftService } from '~/modules/draft/draft.service'

import {
  assertLowercaseRefType,
  assertNoLegacyKeys,
} from '../../helper/api-shape'
import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const createdAt = new Date('2026-08-31T00:00:00.000Z')
const document = {
  createdAt,
  id: '7000000000000000020',
  publishedRevisionId: '7000000000000000021',
  refId: '7000000000000000010',
  refType: 'post',
  updatedAt: createdAt,
}
const revision = (id = '7000000000000000021') => ({
  content: null,
  contentFormat: 'markdown',
  createdAt,
  documentId: document.id,
  id,
  images: [],
  meta: null,
  parentRevisionId: null,
  text: 'Body',
  title: 'Title',
  typeSpecificData: { slug: 'title' },
})
const branch = {
  baseRevision: revision(),
  baseRevisionId: '7000000000000000021',
  commonAncestorRevisionId: '7000000000000000021',
  createdAt,
  document,
  documentId: document.id,
  headRevision: revision('7000000000000000031'),
  headRevisionId: '7000000000000000031',
  id: '7000000000000000030',
  publishedRevision: revision(),
  relationToPublished: 'ancestor',
  status: 'active',
  updatedAt: createdAt,
}

const provider = {
  provide: DraftService,
  useValue: {
    compare: async () => ({
      commonAncestorRevisionId: revision().id,
      left: revision(),
      relation: 'same',
      right: revision(),
    }),
    findById: async () => branch,
    findNewDrafts: async () => [branch],
    findRevisionById: async () => revision(),
    getBranchRevisions: async () => [revision()],
    getContext: async () => ({
      branches: [branch],
      document,
      publishedRevision: revision(),
    }),
    list: async () => ({
      data: [branch],
      pagination: { currentPage: 1, size: 10, total: 1, totalPage: 1 },
    }),
  },
}

describe('DraftController tree contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [DraftController],
    providers: [provider],
  })

  test('GET /drafts returns branch and immutable head revision', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/drafts`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data[0]).toMatchObject({
      document: { published_revision_id: revision().id },
      head_revision: { id: branch.headRevisionId },
      head_revision_id: branch.headRevisionId,
    })
    assertNoLegacyKeys(body)
    assertLowercaseRefType(body)
  })

  test('GET /drafts/context/:refType/:refId returns every branch', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/context/post/${document.refId}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({
      branches: [{ id: branch.id }],
      published_revision: { id: revision().id },
    })
  })

  test('GET /drafts/:id/revisions exposes branch ancestry', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/${branch.id}/revisions`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([
      expect.objectContaining({ id: revision().id }),
    ])
  })
})
