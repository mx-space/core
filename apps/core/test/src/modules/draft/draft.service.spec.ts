import { Test } from '@nestjs/testing'
import { Types } from 'mongoose'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest'

import { BizException } from '~/common/exceptions/biz.exception'
import { DraftModel, DraftRefType } from '~/modules/draft/draft.model'
import { DraftService } from '~/modules/draft/draft.service'
import { DraftHistoryService } from '~/modules/draft/draft-history.service'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { getModelToken } from '~/transformers/model.transformer'

describe('DraftService with FileReference integration', () => {
  let draftService: DraftService
  let mockDraftModel: ReturnType<typeof createMockDraftModel>
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
          draft.save = vi.fn().mockImplementation(async () => draft)
          draft.toObject = () => ({ ...draft })
          return draft
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

      find: vi.fn().mockImplementation((query: any = {}) => {
        const drafts = mockDrafts.filter((draft) => {
          if (query.refType && draft.refType !== query.refType) {
            return false
          }
          if (
            query.refId &&
            draft.refId?.toString() !== query.refId.toString()
          ) {
            return false
          }
          if (query.refId?.$exists === false && draft.refId !== undefined) {
            return false
          }
          return true
        })

        let selectedFields: string[] | null = null

        const chain = {
          select: vi.fn().mockImplementation((fields: string) => {
            selectedFields = fields.split(/\s+/).filter(Boolean)
            return chain
          }),
          sort: vi.fn().mockReturnValue(undefined),
          lean: vi.fn().mockImplementation(() => {
            return drafts.map((draft) => {
              if (!selectedFields) {
                return { ...draft }
              }

              const projected = Object.fromEntries(
                selectedFields
                  .filter((field) => field !== '_id')
                  .map((field) => [field, draft[field]]),
              )
              return {
                ...projected,
                id: draft.id,
              }
            })
          }),
        }

        chain.sort.mockReturnValue(chain)
        return chain
      }),

      findByIdAndUpdate: vi
        .fn()
        .mockImplementation((id: string, update: any) => {
          const draft = mockDrafts.find((d) => d._id === id || d.id === id)
          if (draft && update) {
            Object.assign(draft, update)
          }
          return Promise.resolve(draft)
        }),

      deleteMany: vi.fn().mockImplementation((query: any) => {
        const before = mockDrafts.length
        mockDrafts = mockDrafts.filter((draft) => {
          if (query.refType && draft.refType !== query.refType) {
            return true
          }
          if (
            query.refId &&
            draft.refId?.toString() !== query.refId.toString()
          ) {
            return true
          }
          return false
        })
        return Promise.resolve({ deletedCount: before - mockDrafts.length })
      }),
    }
  }

  beforeEach(async () => {
    mockFileReferenceService = {
      updateReferencesForDocument: vi.fn().mockResolvedValue(undefined),
      removeReferencesForDocument: vi.fn().mockResolvedValue(undefined),
    }

    mockDraftModel = createMockDraftModel()

    const module = await Test.createTestingModule({
      providers: [
        DraftHistoryService,
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
        meta: {},
      }

      const result = await draftService.create(draftData)

      expect(result).toBeDefined()
      expect(
        mockFileReferenceService.updateReferencesForDocument,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ text: draftData.text }),
        expect.any(String),
        FileReferenceType.Draft,
      )
    })

    it('should not track file references when creating draft without text', async () => {
      const draftData = {
        refType: DraftRefType.Post,
        title: 'Empty Draft',
        text: '',
        meta: {},
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
        expect.objectContaining({ text: updateData.text }),
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

    it('should remove file references by canonical id when deleting by ref', async () => {
      const refId = new Types.ObjectId().toHexString()
      mockDrafts.push({
        _id: 'draft-by-ref',
        id: 'draft-by-ref',
        refType: DraftRefType.Post,
        refId: new Types.ObjectId(refId),
        title: 'By Ref',
        text: 'content',
        version: 1,
        history: [],
      })

      await draftService.deleteByRef(DraftRefType.Post, refId)

      expect(mockDraftModel.deleteMany).toHaveBeenCalled()
      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalledWith('draft-by-ref', FileReferenceType.Draft)
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
        meta: {},
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

  describe('History with diff/snapshot hybrid strategy', () => {
    it('should store first version as full snapshot', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Initial',
        text: 'Initial text content',
        version: 1,
        history: [],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      await draftService.update('draft123', { text: 'Updated text content' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history).toHaveLength(1)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
      expect(updatedDraft.history[0].text).toBe('Initial text content')
    })

    it('should store diff for intermediate versions when text is similar', async () => {
      // Use longer, more similar text to ensure diff is smaller than threshold
      const baseText = 'This is a long document with lots of content. '.repeat(
        20,
      )
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Initial',
        text: `${baseText} Version 2 ending.`,
        version: 2,
        history: [
          {
            version: 1,
            title: 'Initial',
            text: `${baseText} Version 1 ending.`,
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      // Small change to ensure diff is small
      await draftService.update('draft123', {
        text: `${baseText} Version 3 ending.`,
      })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history).toHaveLength(2)
      // Version 2 should be stored as diff (small change, not at interval boundary)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(false)
    })

    it('should store full snapshot at interval boundary', async () => {
      // Version 6 (6 % 5 === 1) should trigger full snapshot
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Initial',
        text: 'Version 6 text',
        version: 6,
        history: [
          {
            version: 5,
            title: 'v5',
            text: 'Version 5 text',
            savedAt: new Date(),
            isFullSnapshot: false,
          },
          {
            version: 1,
            title: 'v1',
            text: 'Version 1 text',
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      await draftService.update('draft123', { text: 'Version 7 text' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history).toHaveLength(3)
      // Version 6 (6 % 5 === 1) should be stored as full snapshot
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
      expect(updatedDraft.history[0].text).toBe('Version 6 text')
    })

    it('should fall back to full snapshot when diff is too large', async () => {
      const originalText = 'A'
      const completelyDifferentText = 'B'.repeat(100)

      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Initial',
        text: originalText,
        version: 2,
        history: [
          {
            version: 1,
            title: 'v1',
            text: 'Original',
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      await draftService.update('draft123', { text: completelyDifferentText })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      // When diff is larger than threshold, should store full snapshot
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
    })

    it('should store refVersion when diff is empty', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Title v2',
        text: 'Same text',
        version: 2,
        history: [
          {
            version: 1,
            title: 'Title v1',
            text: 'Same text',
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      await draftService.update('draft123', { title: 'Title v3' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history).toHaveLength(2)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(false)
      expect(updatedDraft.history[0].refVersion).toBe(1)
      expect(updatedDraft.history[0].text).toBeUndefined()
      expect(updatedDraft.history[0].baseVersion).toBe(1)
    })

    it('should restore text from refVersion entries', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Title v3',
        text: 'Same text',
        version: 3,
        history: [
          {
            version: 2,
            title: 'Title v2',
            savedAt: new Date(),
            isFullSnapshot: false,
            refVersion: 1,
          },
          {
            version: 1,
            title: 'Title v1',
            text: 'Same text',
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      const restored = await draftService.restoreVersion('draft123', 2)

      expect(restored.text).toBe('Same text')
      expect(restored.title).toBe('Title v2')
    })

    it('should materialize refVersion entry when trimming history', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Title v150',
        text: 'Same text',
        version: 151,
        history: [],
        updated: new Date(),
        created: new Date(),
      }

      const now = Date.now()
      for (let i = 150; i >= 1; i -= 1) {
        const isFullSnapshot = i === 1
        draft.history.push({
          version: i,
          title: `Title v${i}`,
          text: isFullSnapshot ? 'Same text' : undefined,
          savedAt: new Date(now - i * 1000),
          isFullSnapshot,
          ...(isFullSnapshot ? {} : { refVersion: 1 }),
        })
      }

      mockDrafts.push(draft)

      // Trigger trim by pushing one more history entry
      await draftService.update('draft123', { title: 'Title v152' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history.length).toBeLessThanOrEqual(100)
      expect(updatedDraft.history.some((h: any) => h.version === 1)).toBe(false)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
      expect(updatedDraft.history[0].refVersion).toBeUndefined()
      expect(updatedDraft.history[0].text).toBe('Same text')
    })

    it('should keep a full snapshot when only diffs overflow', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Title v101',
        text: 'Base text',
        version: 101,
        history: [],
        updated: new Date(),
        created: new Date(),
      }

      const now = Date.now()
      for (let i = 100; i >= 1; i -= 1) {
        const isFullSnapshot = i === 1
        draft.history.push({
          version: i,
          title: `Title v${i}`,
          text: isFullSnapshot ? 'Base text' : '@@ -1,0 +1,1 @@\n+diff\n',
          savedAt: new Date(now - i * 1000),
          isFullSnapshot,
          ...(isFullSnapshot ? {} : { baseVersion: 1 }),
        })
      }

      mockDrafts.push(draft)

      // Trigger trim by pushing one more history entry
      await draftService.update('draft123', { title: 'Title v102' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history.length).toBeLessThanOrEqual(100)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
    })

    it('should defer trimming until a full snapshot reaches top', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Title v105',
        text: 'Base text',
        version: 105,
        history: [],
        updated: new Date(),
        created: new Date(),
      }

      const now = Date.now()
      for (let i = 102; i >= 2; i -= 1) {
        const isFullSnapshot = i === 2
        draft.history.push({
          version: i,
          title: `Title v${i}`,
          text: isFullSnapshot ? 'Base text' : '@@ -1,0 +1,1 @@\n+diff\n',
          savedAt: new Date(now - i * 1000),
          isFullSnapshot,
          ...(isFullSnapshot ? {} : { baseVersion: 2 }),
        })
      }

      mockDrafts.push(draft)

      // Version 105 is not a full snapshot, trimming should be deferred.
      await draftService.update('draft123', { title: 'Title v106' })
      let updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history.length).toBe(102)

      // Version 106 is a full snapshot, trimming should happen now.
      await draftService.update('draft123', { title: 'Title v107' })
      updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      expect(updatedDraft.history.length).toBeLessThanOrEqual(100)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
    })

    it('should resolve chained refVersion after trimming history', async () => {
      const draft = {
        _id: 'draft123',
        id: 'draft123',
        refType: DraftRefType.Post,
        title: 'Title v150',
        text: 'Same text',
        version: 151,
        history: [],
        updated: new Date(),
        created: new Date(),
      }

      const now = Date.now()
      for (let i = 150; i >= 1; i -= 1) {
        const isFullSnapshot = i === 1
        const entry: any = {
          version: i,
          title: `Title v${i}`,
          savedAt: new Date(now - i * 1000),
          isFullSnapshot,
        }
        if (isFullSnapshot) {
          entry.text = 'Same text'
        } else if (i === 2) {
          entry.refVersion = 1
        } else {
          entry.refVersion = 2
        }
        draft.history.push(entry)
      }

      mockDrafts.push(draft)

      // Trigger trim by pushing one more history entry
      await draftService.update('draft123', { title: 'Title v152' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'draft123')
      const materialized = updatedDraft.history.find(
        (h: any) => h.version === 150,
      )

      expect(materialized.version).toBe(150)
      expect(materialized.isFullSnapshot).toBe(true)
      expect(materialized.refVersion).toBeUndefined()
      expect(materialized.text).toBe('Same text')
    })
  })

  describe('Lexical contentFormat history', () => {
    const makeLexical = (text: string) =>
      JSON.stringify({
        root: {
          children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
        },
      })

    it('should store first Lexical version as full snapshot with content', async () => {
      const content1 = makeLexical('Hello')
      const draft = {
        _id: 'lexdraft1',
        id: 'lexdraft1',
        refType: DraftRefType.Post,
        title: 'Lexical v1',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: content1,
        version: 1,
        history: [],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      const content2 = makeLexical('Hello World')
      await draftService.update('lexdraft1', { content: content2 })

      const updatedDraft = mockDrafts.find((d) => d.id === 'lexdraft1')
      expect(updatedDraft.history).toHaveLength(1)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
      expect(updatedDraft.history[0].content).toBe(content1)
      expect(updatedDraft.history[0].contentFormat).toBe(ContentFormat.Lexical)
    })

    it('should store incremental diff for Lexical intermediate versions', async () => {
      const baseObj = {
        root: {
          children: Array.from({ length: 20 }, (_, i) => ({
            type: 'paragraph',
            children: [{ type: 'text', text: `Paragraph ${i}` }],
          })),
        },
      }
      const base = JSON.stringify(baseObj)

      const updatedObj = structuredClone(baseObj)
      updatedObj.root.children[0].children[0].text = 'Modified Paragraph 0'
      const updated = JSON.stringify(updatedObj)

      const draft = {
        _id: 'lexdraft2',
        id: 'lexdraft2',
        refType: DraftRefType.Post,
        title: 'Lexical v2',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: updated,
        version: 2,
        history: [
          {
            version: 1,
            title: 'Lexical v1',
            content: base,
            contentFormat: ContentFormat.Lexical,
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      const nextObj = structuredClone(updatedObj)
      nextObj.root.children[1].children[0].text = 'Modified Paragraph 1'
      await draftService.update('lexdraft2', {
        content: JSON.stringify(nextObj),
      })

      const updatedDraft = mockDrafts.find((d) => d.id === 'lexdraft2')
      expect(updatedDraft.history).toHaveLength(2)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(false)
    })

    it('should restore Lexical version from history', async () => {
      const content1 = makeLexical('Version 1')
      const content2 = makeLexical('Version 2')
      const content3 = makeLexical('Version 3')

      const draft = {
        _id: 'lexdraft3',
        id: 'lexdraft3',
        refType: DraftRefType.Post,
        title: 'Lexical v3',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: content3,
        version: 3,
        history: [
          {
            version: 2,
            title: 'Lexical v2',
            content: content2,
            contentFormat: ContentFormat.Lexical,
            savedAt: new Date(),
            isFullSnapshot: true,
          },
          {
            version: 1,
            title: 'Lexical v1',
            content: content1,
            contentFormat: ContentFormat.Lexical,
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      const restored = await draftService.restoreVersion('lexdraft3', 1)
      expect(restored.content).toBe(content1)
      expect(restored.title).toBe('Lexical v1')
    })

    it('should store full Lexical snapshot at interval boundary', async () => {
      const content6 = makeLexical('Version 6')
      const draft = {
        _id: 'lexdraft4',
        id: 'lexdraft4',
        refType: DraftRefType.Post,
        title: 'Lexical v6',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: content6,
        version: 6,
        history: [
          {
            version: 5,
            title: 'v5',
            content: makeLexical('Version 5'),
            contentFormat: ContentFormat.Lexical,
            savedAt: new Date(),
            isFullSnapshot: false,
          },
          {
            version: 1,
            title: 'v1',
            content: makeLexical('Version 1'),
            contentFormat: ContentFormat.Lexical,
            savedAt: new Date(),
            isFullSnapshot: true,
          },
        ],
        updated: new Date(),
        created: new Date(),
      }
      mockDrafts.push(draft)

      await draftService.update('lexdraft4', {
        content: makeLexical('Version 7'),
      })

      const updatedDraft = mockDrafts.find((d) => d.id === 'lexdraft4')
      expect(updatedDraft.history).toHaveLength(3)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
      expect(updatedDraft.history[0].content).toBe(content6)
    })

    it('should trim Lexical history and materialize entries', async () => {
      const content1 = makeLexical('Same content')
      const draft = {
        _id: 'lexdraft5',
        id: 'lexdraft5',
        refType: DraftRefType.Post,
        title: 'Lexical v150',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: content1,
        version: 151,
        history: [] as any[],
        updated: new Date(),
        created: new Date(),
      }

      const now = Date.now()
      for (let i = 150; i >= 1; i -= 1) {
        const isFullSnapshot = i === 1
        draft.history.push({
          version: i,
          title: `Lexical v${i}`,
          content: isFullSnapshot ? content1 : undefined,
          contentFormat: ContentFormat.Lexical,
          savedAt: new Date(now - i * 1000),
          isFullSnapshot,
          ...(isFullSnapshot ? {} : { refVersion: 1 }),
        })
      }

      mockDrafts.push(draft)

      await draftService.update('lexdraft5', { title: 'Lexical v152' })

      const updatedDraft = mockDrafts.find((d) => d.id === 'lexdraft5')
      expect(updatedDraft.history.length).toBeLessThanOrEqual(100)
      expect(updatedDraft.history.some((h: any) => h.version === 1)).toBe(false)
      expect(updatedDraft.history[0].isFullSnapshot).toBe(true)
      expect(updatedDraft.history[0].refVersion).toBeUndefined()
      expect(updatedDraft.history[0].content).toBe(content1)
    })
  })
})
