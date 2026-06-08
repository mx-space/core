import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import { ArticleTypeEnum } from '~/constants/article.constant'
import {
  CATEGORY_SERVICE_TOKEN,
  DRAFT_SERVICE_TOKEN,
} from '~/constants/injection.constant'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import type { PostRepository, PostRow } from '~/modules/post/post.repository'
import { PostService } from '~/modules/post/post.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const createPost = (overrides: Partial<PostRow> = {}): PostRow => ({
  id: 'post-1' as any,
  title: 'Post',
  slug: 'post',
  text: 'body',
  content: null,
  contentFormat: ContentFormat.Markdown,
  summary: null,
  images: [],
  meta: null,
  tags: [],
  categoryId: 'cat-1' as any,
  category: null,
  copyright: true,
  isPublished: true,
  readCount: 0,
  likeCount: 0,
  pinAt: null,
  pinOrder: null,
  related: [],
  createdAt: now,
  modifiedAt: null,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<PostRepository>()
  const categoryService = {
    findCategoryById: vi.fn().mockResolvedValue({
      id: 'cat-1',
      slug: 'default',
      name: 'Default',
    }),
    findBySlug: vi.fn().mockResolvedValue({
      id: 'cat-1',
      slug: 'default',
      name: 'Default',
    }),
  }
  const draftService = {
    linkToPublished: vi.fn(),
    markAsPublished: vi.fn(),
    deleteByRef: vi.fn(),
  }
  const moduleRef = {
    get: vi.fn((token) => {
      if (token === CATEGORY_SERVICE_TOKEN) return categoryService
      if (token === DRAFT_SERVICE_TOKEN) return draftService
      return null
    }),
  }
  const commentService = { deleteForRef: vi.fn() }
  const imageService = { saveImageDimensionsFromMarkdownText: vi.fn() }
  const fileReferenceService = {
    activateReferences: vi.fn(),
    removeReferencesForDocument: vi.fn(),
    updateReferencesForDocument: vi.fn(),
  }
  const eventManager = { emit: vi.fn() }
  const slugTrackerService = {
    createTracker: vi.fn(),
    findTrackerBySlug: vi.fn(),
    deleteAllTracker: vi.fn(),
  }
  const lexicalService = { normalizeContentForStorage: vi.fn() }
  const enrichmentService = { scheduleDocPrefetch: vi.fn() }
  const service = new PostService(
    repository as any,
    commentService as any,
    imageService as any,
    fileReferenceService as any,
    eventManager as any,
    slugTrackerService as any,
    lexicalService as any,
    enrichmentService as any,
    moduleRef as any,
  )
  service.onApplicationBootstrap()

  return {
    categoryService,
    commentService,
    draftService,
    fileReferenceService,
    repository,
    service,
    slugTrackerService,
  }
}

describe('PostService', () => {
  it('creates posts through the PG repository after category and slug validation', async () => {
    const { repository, service } = createService()
    repository.findBySlug.mockResolvedValue(null)
    repository.create.mockResolvedValue(createPost())

    const result = await service.create({
      title: 'Hello World',
      text: 'body',
      categoryId: 'cat-1',
    } as any)

    expect(result.slug).toBe('post')
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello World',
        slug: 'Hello-World',
        categoryId: 'cat-1',
        contentFormat: ContentFormat.Markdown,
      }),
    )
  })

  it('rejects duplicate slugs before creating the PG row', async () => {
    const { repository, service } = createService()
    repository.findBySlug.mockResolvedValue(createPost())

    await expect(
      service.create({
        title: 'Post',
        text: 'body',
        categoryId: 'cat-1',
      } as any),
    ).rejects.toThrow(AppException)

    expect(repository.create).not.toHaveBeenCalled()
  })

  it('links a draft to the created post and removes draft file references', async () => {
    const { draftService, fileReferenceService, repository, service } =
      createService()
    repository.findBySlug.mockResolvedValue(null)
    repository.create.mockResolvedValue(createPost({ id: 'post-2' as any }))

    await service.create({
      title: 'Post',
      text: 'body',
      categoryId: 'cat-1',
      draftId: 'draft-1',
    } as any)

    expect(
      fileReferenceService.removeReferencesForDocument,
    ).toHaveBeenCalledWith('draft-1', FileReferenceType.Draft)
    expect(draftService.linkToPublished).toHaveBeenCalledWith(
      'draft-1',
      'post-2',
    )
    expect(draftService.markAsPublished).toHaveBeenCalledWith('draft-1')
  })

  it('tracks old public paths when slug changes', async () => {
    const { repository, service, slugTrackerService } = createService()
    repository.findById.mockResolvedValue(createPost({ slug: 'old-post' }))
    repository.findBySlug.mockResolvedValue(null)
    repository.update.mockResolvedValue(createPost({ slug: 'new-post' }))

    await service.updateById('post-1', { slug: 'new post' } as any)

    expect(slugTrackerService.createTracker).toHaveBeenCalledWith(
      '/default/old-post',
      ArticleTypeEnum.Post,
      'post-1',
    )
    expect(repository.update).toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({ slug: 'new-post' }),
    )
  })

  it('cleans related records and references when deleting a post', async () => {
    const {
      commentService,
      draftService,
      fileReferenceService,
      repository,
      service,
      slugTrackerService,
    } = createService()
    repository.findById.mockResolvedValue(createPost())
    repository.deleteById.mockResolvedValue(createPost())

    await service.deletePost('post-1')

    expect(repository.deleteById).toHaveBeenCalledWith('post-1')
    expect(commentService.deleteForRef).toHaveBeenCalled()
    expect(draftService.deleteByRef).toHaveBeenCalled()
    expect(slugTrackerService.deleteAllTracker).toHaveBeenCalledWith('post-1')
    expect(
      fileReferenceService.removeReferencesForDocument,
    ).toHaveBeenCalledWith('post-1', FileReferenceType.Post)
  })

  it('rejects missing related post ids', async () => {
    const { repository, service } = createService()
    repository.findManyByIds.mockResolvedValue([])

    await expect(
      service.checkRelated({ relatedId: ['missing'] } as any),
    ).rejects.toThrow(AppException)
  })
})
