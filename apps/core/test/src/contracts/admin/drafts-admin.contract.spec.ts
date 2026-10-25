import { describe, expect, test } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { DraftController } from '~/modules/draft/draft.controller'
import { DraftService } from '~/modules/draft/draft.service'

import { assertHasKeys, assertHasKeysDeep } from '../../../helper/api-shape'
import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'

const fixture = {
  baseRevision: { id: '7000000000000000001' },
  baseRevisionId: '7000000000000000001',
  commonAncestorRevisionId: '7000000000000000001',
  createdAt: new Date('2026-08-31T00:00:00Z'),
  document: {
    id: '7000000000000000002',
    publishedRevisionId: '7000000000000000001',
    refId: '7000000000000000003',
    refType: 'post',
  },
  documentId: '7000000000000000002',
  headRevision: {
    content: null,
    contentFormat: 'markdown',
    id: '7000000000000000004',
    images: [],
    meta: null,
    text: 'Body',
    title: 'Title',
    typeSpecificData: { slug: 'title' },
  },
  headRevisionId: '7000000000000000004',
  id: '7000000000000000005',
  publishedRevision: { id: '7000000000000000001' },
  relationToPublished: 'ancestor',
  status: 'active',
  updatedAt: new Date('2026-08-31T00:01:00Z'),
}

const card = {
  baseRevisionId: fixture.baseRevisionId,
  createdAt: fixture.createdAt,
  document: fixture.document,
  documentId: fixture.documentId,
  headRevision: {
    contentFormat: 'markdown',
    createdAt: fixture.createdAt,
    id: fixture.headRevisionId,
    title: 'Title',
  },
  headRevisionId: fixture.headRevisionId,
  id: fixture.id,
  relation: 'ahead',
  status: 'active',
  storage: { crdtBytes: 0, revisionBytes: 12, revisionCount: 2 },
  updatedAt: fixture.updatedAt,
}

describe('DraftController Admin branch contract (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [DraftController],
    providers: [
      {
        provide: DraftService,
        useValue: {
          findById: async () => fixture,
          findForEditing: async () => fixture,
          listCards: async () => ({
            data: [card],
            pagination: { currentPage: 1, size: 10, total: 1, totalPage: 1 },
          }),
        },
      },
    ],
  })

  test('the draft list exposes card fields without revision bodies', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/drafts`,
    })
    expect(res.statusCode).toBe(200)
    const [item] = res.json().data
    assertHasKeys(item, [
      'id',
      'document_id',
      'head_revision_id',
      'status',
      'relation',
      'created_at',
      'updated_at',
    ])
    assertHasKeysDeep(item, [
      'document.ref_type',
      'document.ref_id',
      'head_revision.title',
      'head_revision.content_format',
      'storage.revision_bytes',
      'storage.revision_count',
      'storage.crdt_bytes',
    ])
    expect(item.head_revision).not.toHaveProperty('text')
  })

  test.each([`${apiRoutePrefix}/drafts/${fixture.id}`])(
    '%s exposes the fields consumed by Admin',
    async (url) => {
      const res = await proxy.app.inject({
        headers: authPassHeader,
        method: 'GET',
        url,
      })
      expect(res.statusCode).toBe(200)
      const item = res.json().data
      assertHasKeys(item, [
        'id',
        'document_id',
        'base_revision_id',
        'head_revision_id',
        'status',
        'relation_to_published',
        'created_at',
        'updated_at',
      ])
      assertHasKeysDeep(item, [
        'document.ref_type',
        'document.published_revision_id',
        'head_revision.title',
        'head_revision.text',
        'head_revision.content_format',
        'head_revision.type_specific_data',
      ])
    },
  )
})
