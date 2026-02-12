import { Test } from '@nestjs/testing'
import {
  FileReferenceModel,
  FileReferenceStatus,
  FileReferenceType,
} from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { getModelToken } from '~/transformers/model.transformer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('FileReferenceService', () => {
  let fileReferenceService: FileReferenceService
  let mockReferences: any[]

  const createMockModel = () => {
    mockReferences = []

    return {
      find: vi.fn().mockImplementation((query: any) => {
        let results = [...mockReferences]

        if (query.fileUrl) {
          results = results.filter((r) => r.fileUrl === query.fileUrl)
        }
        if (query.refId && query.refType) {
          results = results.filter(
            (r) => r.refId === query.refId && r.refType === query.refType,
          )
        }
        if (query.status) {
          results = results.filter((r) => r.status === query.status)
        }

        return {
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue(results),
        }
      }),

      findOne: vi.fn().mockImplementation((query: any) => {
        const found = mockReferences.find((r) => r.fileUrl === query.fileUrl)
        return Promise.resolve(found || null)
      }),

      create: vi.fn().mockImplementation((doc: any) => {
        const newDoc = {
          _id: `ref_${Date.now()}_${Math.random()}`,
          ...doc,
          created: new Date(),
        }
        mockReferences.push(newDoc)
        return Promise.resolve(newDoc)
      }),

      updateMany: vi.fn().mockImplementation((query: any, update: any) => {
        let matchCount = 0
        mockReferences.forEach((ref) => {
          let matches = true

          if (query.fileUrl?.$in) {
            matches = matches && query.fileUrl.$in.includes(ref.fileUrl)
          }
          if (query.refId !== undefined && query.refType !== undefined) {
            matches =
              matches &&
              ref.refId === query.refId &&
              ref.refType === query.refType
          }
          if (query.status) {
            matches = matches && ref.status === query.status
          }

          if (matches) {
            matchCount++
            if (update.$set) {
              Object.assign(ref, update.$set)
            }
          }
        })
        return Promise.resolve({ modifiedCount: matchCount })
      }),

      updateOne: vi
        .fn()
        .mockImplementation((query: any, update: any, options: any) => {
          let ref = mockReferences.find((r) => r.fileUrl === query.fileUrl)

          if (!ref && options?.upsert) {
            ref = {
              _id: `ref_${Date.now()}_${Math.random()}`,
              fileUrl: query.fileUrl,
              fileName: query.fileUrl.split('/').pop(),
              status: FileReferenceStatus.Pending,
              created: new Date(),
            }
            mockReferences.push(ref)
          }

          if (ref && update.$set) {
            Object.assign(ref, update.$set)
          }

          return Promise.resolve({ modifiedCount: ref ? 1 : 0 })
        }),

      deleteOne: vi.fn().mockImplementation((query: any) => {
        const index = mockReferences.findIndex((r) => r._id === query._id)
        if (index !== -1) {
          mockReferences.splice(index, 1)
          return Promise.resolve({ deletedCount: 1 })
        }
        return Promise.resolve({ deletedCount: 0 })
      }),

      countDocuments: vi.fn().mockImplementation((query: any) => {
        let results = mockReferences
        if (query.status) {
          results = results.filter((r) => r.status === query.status)
        }
        return Promise.resolve(results.length)
      }),
    }
  }

  beforeEach(async () => {
    const mockModel = createMockModel()

    const module = await Test.createTestingModule({
      providers: [
        FileReferenceService,
        {
          provide: getModelToken(FileReferenceModel.name),
          useValue: mockModel,
        },
      ],
    }).compile()

    fileReferenceService =
      module.get<FileReferenceService>(FileReferenceService)
  })

  afterEach(() => {
    mockReferences = []
  })

  describe('createPendingReference', () => {
    it('should create a pending reference for a new file', async () => {
      const fileUrl = 'http://example.com/objects/image/test.jpg'
      const fileName = 'test.jpg'

      const result = await fileReferenceService.createPendingReference(
        fileUrl,
        fileName,
      )

      expect(result).toBeDefined()
      expect(result.fileUrl).toBe(fileUrl)
      expect(result.status).toBe(FileReferenceStatus.Pending)
    })

    it('should return existing reference if already exists', async () => {
      const fileUrl = 'http://example.com/objects/image/test.jpg'
      const fileName = 'test.jpg'

      await fileReferenceService.createPendingReference(fileUrl, fileName)
      const result = await fileReferenceService.createPendingReference(
        fileUrl,
        fileName,
      )

      expect(mockReferences.length).toBe(1)
      expect(result.fileUrl).toBe(fileUrl)
    })
  })

  describe('activateReferences', () => {
    it('should activate references for images in markdown text', async () => {
      const fileUrl = 'http://example.com/objects/image/test.jpg'
      mockReferences.push({
        _id: 'ref1',
        fileUrl,
        fileName: 'test.jpg',
        status: FileReferenceStatus.Pending,
      })

      const text = `Some text with an image ![alt](${fileUrl}) and more text`
      const refId = 'post123'
      const refType = FileReferenceType.Post

      await fileReferenceService.activateReferences(text, refId, refType)

      expect(mockReferences[0].status).toBe(FileReferenceStatus.Active)
      expect(mockReferences[0].refId).toBe(refId)
      expect(mockReferences[0].refType).toBe(refType)
    })

    it('should not activate non-local images', async () => {
      const localUrl = 'http://example.com/objects/image/local.jpg'
      const externalUrl = 'http://external.com/image.jpg'

      mockReferences.push({
        _id: 'ref1',
        fileUrl: localUrl,
        fileName: 'local.jpg',
        status: FileReferenceStatus.Pending,
      })

      const text = `![local](${localUrl}) ![external](${externalUrl})`
      await fileReferenceService.activateReferences(
        text,
        'post123',
        FileReferenceType.Post,
      )

      expect(mockReferences[0].status).toBe(FileReferenceStatus.Active)
    })
  })

  describe('updateReferencesForDocument', () => {
    it('should release old references and activate new ones', async () => {
      const oldUrl = 'http://example.com/objects/image/old.jpg'
      const newUrl = 'http://example.com/objects/image/new.jpg'
      const refId = 'post123'
      const refType = FileReferenceType.Post

      mockReferences.push({
        _id: 'ref1',
        fileUrl: oldUrl,
        fileName: 'old.jpg',
        status: FileReferenceStatus.Active,
        refId,
        refType,
      })
      mockReferences.push({
        _id: 'ref2',
        fileUrl: newUrl,
        fileName: 'new.jpg',
        status: FileReferenceStatus.Pending,
      })

      const newText = `Updated content with ![new](${newUrl})`
      await fileReferenceService.updateReferencesForDocument(
        newText,
        refId,
        refType,
      )

      const oldRef = mockReferences.find((r) => r.fileUrl === oldUrl)
      const newRef = mockReferences.find((r) => r.fileUrl === newUrl)

      expect(oldRef.status).toBe(FileReferenceStatus.Pending)
      expect(oldRef.refId).toBeNull()
      expect(newRef.status).toBe(FileReferenceStatus.Active)
      expect(newRef.refId).toBe(refId)
    })
  })

  describe('removeReferencesForDocument', () => {
    it('should set references to pending status', async () => {
      const refId = 'draft123'
      const refType = FileReferenceType.Draft

      mockReferences.push({
        _id: 'ref1',
        fileUrl: 'http://example.com/objects/image/test.jpg',
        fileName: 'test.jpg',
        status: FileReferenceStatus.Active,
        refId,
        refType,
      })

      await fileReferenceService.removeReferencesForDocument(refId, refType)

      expect(mockReferences[0].status).toBe(FileReferenceStatus.Pending)
      expect(mockReferences[0].refId).toBeNull()
    })
  })

  describe('Draft to Post reference transfer', () => {
    it('should transfer references from draft to post on publish', async () => {
      const imageUrl = 'http://example.com/objects/image/test.jpg'
      const draftId = 'draft123'
      const postId = 'post456'

      mockReferences.push({
        _id: 'ref1',
        fileUrl: imageUrl,
        fileName: 'test.jpg',
        status: FileReferenceStatus.Active,
        refId: draftId,
        refType: FileReferenceType.Draft,
      })

      await fileReferenceService.removeReferencesForDocument(
        draftId,
        FileReferenceType.Draft,
      )

      expect(mockReferences[0].status).toBe(FileReferenceStatus.Pending)

      const postText = `Content with ![image](${imageUrl})`
      await fileReferenceService.activateReferences(
        postText,
        postId,
        FileReferenceType.Post,
      )

      expect(mockReferences[0].status).toBe(FileReferenceStatus.Active)
      expect(mockReferences[0].refId).toBe(postId)
      expect(mockReferences[0].refType).toBe(FileReferenceType.Post)
    })
  })
})
