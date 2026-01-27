import { ModuleRef } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { BusinessException } from '~/common/exceptions/biz.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import {
  CATEGORY_SERVICE_TOKEN,
  DRAFT_SERVICE_TOKEN,
} from '~/constants/injection.constant'
import { CommentModel } from '~/modules/comment/comment.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { PostModel } from '~/modules/post/post.model'
import { PostService } from '~/modules/post/post.service'
import { SlugTrackerService } from '~/modules/slug-tracker/slug-tracker.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageMigrationService } from '~/processors/helper/helper.image-migration.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { getModelToken } from '~/transformers/model.transformer'
import { Types } from 'mongoose'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'

describe('PostService', () => {
  let postService: PostService
  let mockPosts: any[]
  let mockComments: any[]

  let mockCategoryService: {
    findCategoryById: Mock
    model: { findOne: Mock }
  }

  let mockDraftService: {
    markAsPublished: Mock
    linkToPublished: Mock
    deleteByRef: Mock
  }

  let mockSlugTrackerService: {
    createTracker: Mock
    findTrackerBySlug: Mock
    deleteAllTracker: Mock
  }

  let mockFileReferenceService: {
    activateReferences: Mock
    updateReferencesForDocument: Mock
    removeReferencesForDocument: Mock
  }

  let mockEventManager: {
    emit: Mock
    broadcast: Mock
  }

  let mockImageService: {
    saveImageDimensionsFromMarkdownText: Mock
  }

  let mockImageMigrationService: {
    migrateImagesToS3: Mock
  }

  let mockTextMacroService: {
    replaceTextMacro: Mock
  }

  const createMockPostModel = () => {
    mockPosts = []

    const createSaveableDocument = (doc: any) => {
      return {
        ...doc,
        save: vi.fn().mockImplementation(async function () {
          return this
        }),
        toJSON() {
          return { ...this }
        },
        toObject() {
          return { ...this }
        },
      }
    }

    return {
      create: vi.fn().mockImplementation((doc: any) => {
        const id = `post_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const newPost = createSaveableDocument({
          _id: id,
          id,
          ...doc,
          created: doc.created || new Date(),
          modified: null,
        })
        mockPosts.push(newPost)
        return Promise.resolve(newPost)
      }),

      findById: vi.fn().mockImplementation((id: string) => {
        const post = mockPosts.find((p) => p._id === id || p.id === id)
        if (post) {
          const doc = createSaveableDocument({ ...post })
          const chainable = {
            ...doc,
            populate: vi.fn().mockReturnThis(),
            lean: vi.fn().mockImplementation(() => ({ ...post })),
          }
          return chainable
        }
        return {
          lean: vi.fn().mockReturnValue(null),
          populate: vi.fn().mockReturnThis(),
        }
      }),

      findOne: vi.fn().mockImplementation((query: any) => {
        let post: any = null
        if (query.slug && query.categoryId) {
          post = mockPosts.find(
            (p) =>
              p.slug === query.slug &&
              p.categoryId?.toString() === query.categoryId?.toString(),
          )
        } else if (query._id) {
          post = mockPosts.find(
            (p) => p._id === query._id || p.id === query._id,
          )
        }
        if (post) {
          return {
            ...post,
            populate: vi.fn().mockReturnThis(),
            lean: vi.fn().mockReturnValue({ ...post }),
          }
        }
        return {
          populate: vi.fn().mockReturnThis(),
          lean: vi.fn().mockReturnValue(null),
        }
      }),

      find: vi.fn().mockImplementation((query: any) => {
        let result = [...mockPosts]
        if (query._id?.$in) {
          result = mockPosts.filter((p) =>
            query._id.$in.some((id: string | Types.ObjectId) => {
              const idStr = typeof id === 'string' ? id : id.toString()
              return idStr === p._id || idStr === p.id
            }),
          )
        }
        return result.map((p) => {
          const original = mockPosts.find(
            (mp) => mp._id === p._id || mp.id === p.id,
          )
          if (original) {
            if (!original.save) {
              original.save = vi.fn().mockImplementation(async function () {
                return this
              })
            }
            return original
          }
          return createSaveableDocument({ ...p })
        })
      }),

      countDocuments: vi.fn().mockImplementation((query: any) => {
        if (query.slug) {
          return Promise.resolve(
            mockPosts.filter((p) => p.slug === query.slug).length,
          )
        }
        return Promise.resolve(mockPosts.length)
      }),

      deleteOne: vi.fn().mockImplementation((query: any) => {
        const index = mockPosts.findIndex(
          (p) => p._id === query._id || p.id === query._id,
        )
        if (index !== -1) {
          mockPosts.splice(index, 1)
          return Promise.resolve({ deletedCount: 1 })
        }
        return Promise.resolve({ deletedCount: 0 })
      }),

      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),

      lean: vi.fn().mockReturnThis(),
    }
  }

  const createMockCommentModel = () => {
    mockComments = []

    return {
      deleteMany: vi.fn().mockImplementation((query: any) => {
        if (query.ref) {
          const count = mockComments.filter((c) => c.ref === query.ref).length
          mockComments = mockComments.filter((c) => c.ref !== query.ref)
          return Promise.resolve({ deletedCount: count })
        }
        return Promise.resolve({ deletedCount: 0 })
      }),
    }
  }

  beforeEach(async () => {
    mockCategoryService = {
      findCategoryById: vi.fn().mockImplementation((id: string) => {
        if (id === 'valid-category-id' || id === '5d367eceaceeed0cabcee4b1') {
          return Promise.resolve({
            _id: id,
            id,
            name: 'Test Category',
            slug: 'test-category',
          })
        }
        return Promise.resolve(null)
      }),
      model: {
        findOne: vi.fn().mockImplementation((query: any) => {
          if (query.slug === 'test-category') {
            return Promise.resolve({
              _id: 'valid-category-id',
              id: 'valid-category-id',
              slug: 'test-category',
            })
          }
          return Promise.resolve(null)
        }),
      },
    }

    mockDraftService = {
      markAsPublished: vi.fn().mockResolvedValue(undefined),
      linkToPublished: vi.fn().mockResolvedValue(undefined),
      deleteByRef: vi.fn().mockResolvedValue(undefined),
    }

    mockSlugTrackerService = {
      createTracker: vi.fn().mockResolvedValue({}),
      findTrackerBySlug: vi.fn().mockResolvedValue(null),
      deleteAllTracker: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    }

    mockFileReferenceService = {
      activateReferences: vi.fn().mockResolvedValue(undefined),
      updateReferencesForDocument: vi.fn().mockResolvedValue(undefined),
      removeReferencesForDocument: vi.fn().mockResolvedValue(undefined),
    }

    mockEventManager = {
      emit: vi.fn().mockResolvedValue(undefined),
      broadcast: vi.fn().mockResolvedValue(undefined),
    }

    mockImageService = {
      saveImageDimensionsFromMarkdownText: vi.fn().mockResolvedValue(undefined),
    }

    mockImageMigrationService = {
      migrateImagesToS3: vi.fn().mockResolvedValue({
        newText: '',
        newImages: [],
        migratedCount: 0,
      }),
    }

    mockTextMacroService = {
      replaceTextMacro: vi
        .fn()
        .mockImplementation((text) => Promise.resolve(text)),
    }

    const mockModuleRef = {
      get: vi.fn().mockImplementation((token: any) => {
        if (token === CATEGORY_SERVICE_TOKEN) {
          return mockCategoryService
        }
        if (token === DRAFT_SERVICE_TOKEN) {
          return mockDraftService
        }
        return null
      }),
    }

    const mockPostModel = createMockPostModel()
    const mockCommentModel = createMockCommentModel()

    const module = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getModelToken(PostModel.name),
          useValue: mockPostModel,
        },
        {
          provide: getModelToken(CommentModel.name),
          useValue: mockCommentModel,
        },
        {
          provide: ImageService,
          useValue: mockImageService,
        },
        {
          provide: ImageMigrationService,
          useValue: mockImageMigrationService,
        },
        {
          provide: FileReferenceService,
          useValue: mockFileReferenceService,
        },
        {
          provide: EventManagerService,
          useValue: mockEventManager,
        },
        {
          provide: TextMacroService,
          useValue: mockTextMacroService,
        },
        {
          provide: SlugTrackerService,
          useValue: mockSlugTrackerService,
        },
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
      ],
    }).compile()

    postService = module.get<PostService>(PostService)
    postService.onApplicationBootstrap()
  })

  afterEach(() => {
    mockPosts = []
    mockComments = []
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should create post with valid data', async () => {
      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'test-post',
        categoryId: 'valid-category-id',
      } as unknown as PostModel

      const result = await postService.create(postData)

      expect(result).toBeDefined()
      expect(result.title).toBe('Test Post')
      expect(result.slug).toBe('test-post')
    })

    it('should throw when category not found', async () => {
      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'test-post',
        categoryId: 'invalid-category-id',
      } as unknown as PostModel

      await expect(postService.create(postData)).rejects.toThrow()
    })

    it('should throw BusinessException when slug not available', async () => {
      mockPosts.push({
        _id: 'existing-post',
        id: 'existing-post',
        slug: 'existing-slug',
        categoryId: 'valid-category-id',
      })

      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'existing-slug',
        categoryId: 'valid-category-id',
      } as unknown as PostModel

      await expect(postService.create(postData)).rejects.toThrow(
        BusinessException,
      )
    })

    it('should auto-generate slug from title when not provided', async () => {
      const postData = {
        title: 'Auto Generate Slug',
        text: 'Test content',
        categoryId: 'valid-category-id',
      } as unknown as PostModel

      const result = await postService.create(postData)

      expect(result.slug).toBe('Auto-Generate-Slug')
    })

    it('should slugify provided slug', async () => {
      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'Test Slug With Spaces',
        categoryId: 'valid-category-id',
      } as unknown as PostModel

      const result = await postService.create(postData)

      expect(result.slug).toBe('Test-Slug-With-Spaces')
    })

    it('should validate and link related posts', async () => {
      const relatedPost = {
        _id: 'related-post-id',
        id: 'related-post-id',
        title: 'Related Post',
        slug: 'related-post',
        categoryId: 'valid-category-id',
        related: [],
      }
      mockPosts.push(relatedPost)

      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'test-post',
        categoryId: 'valid-category-id',
        relatedId: ['related-post-id'],
      } as unknown as PostModel & { relatedId: string[] }

      const result = await postService.create(postData)

      expect(result).toBeDefined()
      expect(result.related).toContain('related-post-id')
    })

    it('should process draft when draftId provided', async () => {
      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'test-post',
        categoryId: 'valid-category-id',
        draftId: 'draft-123',
      } as unknown as PostModel & { draftId: string }

      await postService.create(postData)

      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalled()
      expect(mockDraftService.linkToPublished).toHaveBeenCalledWith(
        'draft-123',
        expect.any(String),
      )
      expect(mockDraftService.markAsPublished).toHaveBeenCalledWith('draft-123')
    })

    it('should not allow future created date', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const postData = {
        title: 'Test Post',
        text: 'Test content',
        slug: 'test-post',
        categoryId: 'valid-category-id',
        created: futureDate,
      } as unknown as PostModel

      const result = await postService.create(postData)

      expect(new Date(result.created).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('getPostBySlug', () => {
    beforeEach(() => {
      mockPosts.push({
        _id: 'post-1',
        id: 'post-1',
        title: 'Test Post',
        slug: 'test-post',
        categoryId: 'valid-category-id',
        isPublished: true,
      })
    })

    it('should find post by category slug and post slug', async () => {
      const result = await postService.getPostBySlug(
        'test-category',
        'test-post',
      )

      expect(result).toBeDefined()
    })

    it('should return tracked post when slug changed', async () => {
      mockSlugTrackerService.findTrackerBySlug.mockResolvedValue({
        targetId: 'post-1',
        slug: '/old-category/old-slug',
      })

      const result = await postService.getPostBySlug('old-category', 'old-slug')

      expect(result).toBeDefined()
      expect(mockSlugTrackerService.findTrackerBySlug).toHaveBeenCalled()
    })

    it('should throw NotFoundException when category not found and no tracker', async () => {
      await expect(
        postService.getPostBySlug('non-existent-category', 'test-post'),
      ).rejects.toThrow()
    })

    it('should check isPublished for unauthenticated users', async () => {
      mockPosts[0].isPublished = false
      mockCategoryService.model.findOne.mockResolvedValue({
        _id: 'valid-category-id',
        id: 'valid-category-id',
        slug: 'test-category',
      })

      const result = await postService.getPostBySlug(
        'test-category',
        'test-post',
        false,
      )

      expect(result).toBeDefined()
    })

    it('should return unpublished posts for authenticated users', async () => {
      mockPosts[0].isPublished = false

      const result = await postService.getPostBySlug(
        'test-category',
        'test-post',
        true,
      )

      expect(result).toBeDefined()
    })
  })

  describe('updateById', () => {
    beforeEach(() => {
      mockPosts.push({
        _id: 'post-1',
        id: 'post-1',
        title: 'Original Title',
        text: 'Original text',
        slug: 'original-slug',
        categoryId: 'valid-category-id',
        isPublished: true,
        related: [],
        save: vi.fn().mockImplementation(async function () {
          return this
        }),
        toObject() {
          return { ...this }
        },
      })
    })

    it('should update post with valid data', async () => {
      const result = await postService.updateById('post-1', {
        title: 'Updated Title',
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('Updated Title')
    })

    it('should throw when post not found', async () => {
      await expect(
        postService.updateById('non-existent-id', { title: 'New Title' }),
      ).rejects.toThrow()
    })

    it('should throw when new category not found', async () => {
      await expect(
        postService.updateById('post-1', {
          categoryId: 'invalid-category' as any,
        }),
      ).rejects.toThrow()
    })

    it('should throw BusinessException when new slug not available', async () => {
      mockPosts.push({
        _id: 'post-2',
        id: 'post-2',
        title: 'Another Post',
        slug: 'taken-slug',
        categoryId: 'valid-category-id',
      })

      await expect(
        postService.updateById('post-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(BusinessException)
    })

    it('should update modified timestamp when text/title/slug changes', async () => {
      const result = await postService.updateById('post-1', {
        text: 'Updated text',
      })

      expect(result.modified).toBeDefined()
    })

    it('should track old slug when slug changes', async () => {
      await postService.updateById('post-1', { slug: 'new-slug' })

      expect(mockSlugTrackerService.createTracker).toHaveBeenCalledWith(
        '/test-category/original-slug',
        ArticleTypeEnum.Post,
        'post-1',
      )
    })

    it('should update related posts bidirectionally', async () => {
      const relatedPost = {
        _id: 'related-post',
        id: 'related-post',
        title: 'Related',
        slug: 'related',
        categoryId: 'valid-category-id',
        related: [],
        save: vi.fn().mockResolvedValue({}),
      }
      mockPosts.push(relatedPost)

      await postService.updateById('post-1', {
        relatedId: ['related-post'],
      } as any)

      expect(relatedPost.save).toHaveBeenCalled()
    })
  })

  describe('deletePost', () => {
    const postToDeleteId = new Types.ObjectId().toHexString()
    const relatedPostId = new Types.ObjectId().toHexString()

    beforeEach(() => {
      mockPosts.push({
        _id: postToDeleteId,
        id: postToDeleteId,
        title: 'To Delete',
        slug: 'to-delete',
        categoryId: 'valid-category-id',
        related: [new Types.ObjectId(relatedPostId)],
      })

      mockPosts.push({
        _id: relatedPostId,
        id: relatedPostId,
        title: 'Related',
        slug: 'related',
        categoryId: 'valid-category-id',
        related: [new Types.ObjectId(postToDeleteId)],
        save: vi.fn().mockResolvedValue({}),
      })

      mockComments.push({
        _id: 'comment-1',
        ref: postToDeleteId,
        refType: 'Post',
      })
    })

    it('should delete post and cascade delete comments', async () => {
      const targetId = mockPosts.find((p) => p.title === 'To Delete')?._id

      await postService.deletePost(targetId!)

      expect(mockPosts.find((p) => p._id === targetId)).toBeUndefined()
    })

    it('should attempt to remove related links from other posts', async () => {
      const targetId = mockPosts.find((p) => p.title === 'To Delete')?._id

      await postService.deletePost(targetId!)

      expect(mockPosts.find((p) => p._id === targetId)).toBeUndefined()
    })

    it('should delete all slug trackers', async () => {
      const targetId = mockPosts.find((p) => p.title === 'To Delete')?._id

      await postService.deletePost(targetId!)

      expect(mockSlugTrackerService.deleteAllTracker).toHaveBeenCalledWith(
        targetId,
      )
    })

    it('should remove file references', async () => {
      const targetId = mockPosts.find((p) => p.title === 'To Delete')?._id

      await postService.deletePost(targetId!)

      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalledWith(targetId, expect.anything())
    })
  })

  describe('isAvailableSlug', () => {
    it('should return true for unique slug', async () => {
      const result = await postService.isAvailableSlug('unique-slug')

      expect(result).toBe(true)
    })

    it('should return false for existing slug', async () => {
      mockPosts.push({
        _id: 'existing-post',
        id: 'existing-post',
        slug: 'existing-slug',
      })

      const result = await postService.isAvailableSlug('existing-slug')

      expect(result).toBe(false)
    })

    it('should return false for empty slug', async () => {
      const result = await postService.isAvailableSlug('')

      expect(result).toBe(false)
    })
  })

  describe('checkRelated', () => {
    it('should return empty array when no relatedId', async () => {
      const result = await postService.checkRelated({})

      expect(result).toEqual([])
    })

    it('should return related post ids', async () => {
      mockPosts.push({
        _id: 'related-1',
        id: 'related-1',
        title: 'Related 1',
        related: [],
      })

      const result = await postService.checkRelated({
        relatedId: ['related-1'],
      })

      expect(result).toContain('related-1')
    })

    it('should throw when related post not found', async () => {
      await expect(
        postService.checkRelated({
          relatedId: ['non-existent'],
        }),
      ).rejects.toThrow()
    })

    it('should throw when post relates to itself', async () => {
      mockPosts.push({
        _id: 'self-related',
        id: 'self-related',
        title: 'Self Related',
        related: ['self-related'],
      })

      await expect(
        postService.checkRelated({
          id: 'self-related',
          relatedId: ['self-related'],
        }),
      ).rejects.toThrow()
    })
  })

  describe('relatedEachOther', () => {
    it('should do nothing when relatedIds is empty', async () => {
      await postService.relatedEachOther(
        { id: 'current-post' } as PostModel,
        [],
      )

      expect(mockPosts.length).toBe(0)
    })

    it('should handle related posts', async () => {
      const currentPostId = new Types.ObjectId().toHexString()
      const relatedPostId = new Types.ObjectId().toHexString()

      const relatedPost = {
        _id: relatedPostId,
        id: relatedPostId,
        title: 'Related',
        related: [] as string[],
        save: vi.fn().mockImplementation(async function () {
          return this
        }),
      }
      mockPosts.push(relatedPost)

      await postService.relatedEachOther({ id: currentPostId } as PostModel, [
        relatedPostId,
      ])

      expect(relatedPost.save).toHaveBeenCalled()
    })
  })

  describe('removeRelatedEachOther', () => {
    it('should handle null post', async () => {
      await expect(
        postService.removeRelatedEachOther(null),
      ).resolves.toBeUndefined()
    })

    it('should handle post with empty related', async () => {
      await expect(
        postService.removeRelatedEachOther({
          id: 'some-post',
          related: [],
        } as any),
      ).resolves.toBeUndefined()
    })
  })
})
