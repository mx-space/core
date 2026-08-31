import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import {
  type DraftRow,
  publishSavedDraft,
  saveDraftPayload,
  splitDraftBody,
} from '../../src/cli/draft/_shared'
import type { ApiService } from '../../src/services/Api'

const revision = {
  content: null,
  content_format: 'markdown',
  id: 'published-1',
  images: [{ src: 'cover.jpg' }],
  meta: { lang: 'zh' },
  text: 'Published body',
  title: 'Published title',
  type_specific_data: { slug: 'published-post', tags: ['css'] },
}

describe('tree draft CLI contract', () => {
  it('keeps images in the revision snapshot instead of type-specific data', () => {
    expect(splitDraftBody({ images: [{ src: 'cover.jpg' }], slug: 'post' }))
      .toEqual({
        images: [{ src: 'cover.jpg' }],
        typeSpecificData: { slug: 'post' },
      })
  })

  it('creates a new branch from the published revision without selecting another draft', async () => {
    const request = vi.fn((path: string) =>
      Effect.succeed(
        path.startsWith('/drafts/context/')
          ? {
              branches: [{ id: 'unrelated-newer-branch' }],
              document: {
                id: 'document-1',
                published_revision_id: 'published-1',
                ref_id: 'post-1',
                ref_type: 'post',
              },
              published_revision: revision,
            }
          : {
              document: {
                id: 'document-1',
                published_revision_id: 'published-1',
                ref_id: 'post-1',
                ref_type: 'post',
              },
              head_revision: { ...revision, id: 'revision-2' },
              head_revision_id: 'revision-2',
              id: 'branch-2',
              relation_to_published: 'ancestor',
              status: 'active',
            },
      ),
    )
    const api = { request } as unknown as ApiService

    await Effect.runPromise(
      saveDraftPayload(api, 'post', { summary: 'New summary' }, 'post-1'),
    )

    expect(request).toHaveBeenNthCalledWith(
      2,
      '/drafts',
      expect.objectContaining({
        body: expect.objectContaining({
          baseRevisionId: 'published-1',
          data: expect.objectContaining({
            text: 'Published body',
            typeSpecificData: {
              slug: 'published-post',
              summary: 'New summary',
              tags: ['css'],
            },
          }),
        }),
        method: 'POST',
      }),
    )
  })

  it('publishes an explicit divergent branch with the frozen pointer', async () => {
    const request = vi.fn(() => Effect.succeed({ id: 'task-1' }))
    const api = { request } as unknown as ApiService
    const branch = {
      document: {
        id: 'document-1',
        publishedRevisionId: 'published-2',
        refId: 'post-1',
        refType: 'post',
      },
      headRevision: {
        content: null,
        contentFormat: 'markdown',
        id: 'revision-old-branch',
        images: [],
        meta: null,
        text: 'Old branch',
        title: 'Old branch',
        typeSpecificData: null,
      },
      headRevisionId: 'revision-old-branch',
      id: 'branch-old',
      relationToPublished: 'diverged',
      status: 'active',
    } as DraftRow

    await Effect.runPromise(publishSavedDraft(api, branch))

    expect(request).toHaveBeenCalledWith('/publish-jobs', {
      body: {
        aiResources: [],
        branchId: 'branch-old',
        confirmDiverged: true,
        expectedPublishedRevisionId: 'published-2',
        revisionId: 'revision-old-branch',
      },
      method: 'POST',
    })
  })
})
