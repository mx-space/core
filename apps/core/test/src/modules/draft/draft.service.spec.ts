import { Test } from '@nestjs/testing'
import { BizException } from '~/common/exceptions/biz.exception'
import { DraftModel, DraftRefType } from '~/modules/draft/draft.model'
import { DraftService } from '~/modules/draft/draft.service'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { getModelToken } from '~/transformers/model.transformer'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'

describe('DraftService with FileReference integration', () => {
  let draftService: DraftService
  let mockFileReferenceService: {
    updateReferencesForDocument: Mock
    removeReferencesForDocument: Mock
  }
  let mockDrafts: any[]

  const createMockDraftModel = () => {
    mockDrafts = []

    return {
      findOne: vi.fn().mockImplementation((query: any) => {
        if (query.refType && query.refId) {
          return Promise.resolve(
            mockDrafts.find(
              (d) =>
                d.refType === query.refType &&
                d.refId?.toString() === query.refId.toString(),
            ) || null,
          )
        }
        return Promise.resolve(null)
      }),

      findById: vi.fn().mockImplementation((id: string) => {
        const draft = mockDrafts.find((d) => d._id === id || d.id === id)
        if (draft) {
          return {
            ...draft,
            save: vi.fn().mockImplementation(async () => {
              return draft
            }),
            toObject: () => ({ ...draft }),
          }
        }
        return null
      }),

      create: vi.fn().mockImplementation((doc: any) => {
        const id = `draft_${Date.now()}_${Math.random()}`
        const newDraft = {
          _id: id,
          id,
          ...doc,
          history: [],
          created: new Date(),
          updated: new Date(),
          toJSON() {
            return this
          },
          toObject() {
            return this
          },
        }
        mockDrafts.push(newDraft)
        return Promise.resolve({
          ...newDraft,
          toObject: () => newDraft,
        })
      }),

      deleteOne: vi.fn().mockImplementation((query: any) => {
        const index = mockDrafts.findIndex((d) => d._id === query._id)
        if (index !== -1) {
          mockDrafts.splice(index, 1)
          return Promise.resolve({ deletedCount: 1 })
        }
        return Promise.resolve({ deletedCount: 0 })
      }),

      find: vi.fn().mockImplementation(() => ({
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockImplementation(() => ({
          getters: true,
        })),
      })),

      findByIdAndUpdate: vi
        .fn()
        .mockImplementation((id: string, update: any) => {
          const draft = mockDrafts.find((d) => d._id === id || d.id === id)
          if (draft && update) {
            Object.assign(draft, update)
          }
          return Promise.resolve(draft)
        }),
    }
  }

  beforeEach(async () => {
    mockFileReferenceService = {
      updateReferencesForDocument: vi.fn().mockResolvedValue(undefined),
      removeReferencesForDocument: vi.fn().mockResolvedValue(undefined),
    }

    const mockDraftModel = createMockDraftModel()

    const module = await Test.createTestingModule({
      providers: [
        DraftService,
        {
          provide: getModelToken(DraftModel.name),
          useValue: mockDraftModel,
        },
        {
          provide: FileReferenceService,
          useValue: mockFileReferenceService,
        },
      ],
    }).compile()

    draftService = module.get<DraftService>(DraftService)
  })

  afterEach(() => {
    mockDrafts = []
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should track file references when creating draft with text', async () => {
      const imageUrl = 'http://example.com/objects/image/test.jpg'
      const draftData = {
        refType: DraftRefType.Post,
        title: 'Test Draft',
        text: `Content with ![image](${imageUrl})`,
      }

      const result = await draftService.create(draftData)

      expect(result).toBeDefined()
      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).toHaveBeenCalledWith(
        draftData.text,
        expect.any(String),
        FileReferenceType.Draft,
      )
    })

    it('should not track file references when creating draft without text', async () => {
      const draftData = {
        refType: DraftRefType.Post,
        title: 'Empty Draft',
        text: '',
      }

      await draftService.create(draftData)

      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('should update file references when text changes', async () => {
      const initialDraft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Initial',
        text: 'Initial text',
        version: 1,
        history: [],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(initialDraft)

      const newImageUrl = 'http://example.com/objects/image/new.jpg'
      const updateData = {
        text: `Updated with ![new](${newImageUrl})`,
      }

      await draftService.update('draft123', updateData)

      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).toHaveBeenCalledWith(
        updateData.text,
        'draft123',
        FileReferenceType.Draft,
      )
    })

    it('should not update file references when only title changes', async () => {
      const initialDraft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Initial',
        text: 'Some text',
        version: 1,
        history: [],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(initialDraft)

      await draftService.update('draft123', { title: 'New Title' })

      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should remove file references when deleting draft', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'To Delete',
        text: 'Content with ![image](http://example.com/objects/image/test.jpg)',
        version: 1,
        history: [],
      }
      mockDrafts.push(draft)

      await draftService.delete('draft123')

      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalledWith('draft123', FileReferenceType.Draft)
    })

    it('should throw BizException when draft does not exist', async () => {
      await expect(draftService.delete('nonexistent')).rejects.toThrow(
        BizException,
      )
    })
  })

  describe('Draft lifecycle with file references', () => {
    it('should properly manage references through draft lifecycle', async () => {
      const imageUrl1 = 'http://example.com/objects/image/image1.jpg'
      const imageUrl2 = 'http://example.com/objects/image/image2.jpg'

      const draft = await draftService.create({
        refType: DraftRefType.Post,
        title: 'Lifecycle Test',
        text: `First image ![img1](${imageUrl1})`,
      })

      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).toHaveBeenCalledTimes(1)

      const draftId = (draft as any).id || (draft as any)._id
      await draftService.update(draftId, {
        text: `Changed to ![img2](${imageUrl2})`,
      })

      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).toHaveBeenCalledTimes(2)

      await draftService.delete(draftId)

      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalledWith(expect.any(String), FileReferenceType.Draft)
    })
  })
})
