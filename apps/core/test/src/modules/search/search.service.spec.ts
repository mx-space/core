import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type { SearchRepository } from '~/modules/search/search.repository'
import { SearchService } from '~/modules/search/search.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const article = {
  id: 'post-1',
  title: 'Searchable Post',
  slug: 'searchable-post',
  text: 'Body text',
  contentFormat: ContentFormat.Markdown,
  createdAt: now,
  modifiedAt: null,
  isPublished: true,
}

describe('SearchService', () => {
  it('rebuilds PG search documents from current post, page, and note services', async () => {
    const noteService = { findRecent: vi.fn().mockResolvedValue([]) }
    const postService = { findRecent: vi.fn().mockResolvedValue([article]) }
    const pageService = { findRecent: vi.fn().mockResolvedValue([]) }
    const repository = createPgRepositoryMock<SearchRepository>()
    repository.deleteAll.mockResolvedValue(0)
    repository.upsert.mockResolvedValue(undefined)
    const service = new SearchService(
      noteService as any,
      postService as any,
      pageService as any,
      repository as any,
    )

    await expect(service.rebuildSearchDocuments()).resolves.toEqual({
      total: 1,
    })

    expect(repository.deleteAll).toHaveBeenCalledBefore(repository.upsert)
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        refType: 'post',
        refId: 'post-1',
        title: 'searchable post',
        searchText: 'body text',
      }),
    )
  })

  it('upserts a post search document after a post event', async () => {
    const noteService = {}
    const postService = {
      findById: vi.fn().mockResolvedValue(article),
    }
    const pageService = {}
    const repository = createPgRepositoryMock<SearchRepository>()
    repository.upsert.mockResolvedValue(undefined)
    const service = new SearchService(
      noteService as any,
      postService as any,
      pageService as any,
      repository as any,
    )

    await service.onPostCreate({ id: 'post-1' })

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ refType: 'post', refId: 'post-1' }),
    )
  })
})
