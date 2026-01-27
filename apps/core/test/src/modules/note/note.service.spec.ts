import { Test } from '@nestjs/testing'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CommentService } from '~/modules/comment/comment.service'
import { DraftService } from '~/modules/draft/draft.service'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { NoteModel } from '~/modules/note/note.model'
import { NoteService } from '~/modules/note/note.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageMigrationService } from '~/processors/helper/helper.image-migration.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
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

describe('NoteService', () => {
  let noteService: NoteService
  let mockNotes: any[]
  let mockComments: any[]

  let mockFileReferenceService: {
    activateReferences: Mock
    updateReferencesForDocument: Mock
    removeReferencesForDocument: Mock
  }

  let mockEventManager: {
    emit: Mock
    broadcast: Mock
  }

  let mockCommentService: {
    model: {
      deleteMany: Mock
    }
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

  let mockDraftService: {
    markAsPublished: Mock
    linkToPublished: Mock
    deleteByRef: Mock
  }

  let nidCounter: number

  const createMockNoteModel = () => {
    mockNotes = []
    nidCounter = 1

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
        const id = `note_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const newNote = createSaveableDocument({
          _id: id,
          id,
          nid: nidCounter++,
          ...doc,
          created: doc.created || new Date(),
          modified: null,
          isPublished: doc.isPublished ?? true,
        })
        mockNotes.push(newNote)
        return Promise.resolve(newNote)
      }),

      findById: vi.fn().mockImplementation((id: string) => {
        const note = mockNotes.find((n) => n._id === id || n.id === id)
        if (note) {
          return {
            ...createSaveableDocument({ ...note }),
            lean: vi.fn().mockReturnValue({ ...note }),
          }
        }
        return {
          lean: vi.fn().mockReturnValue(null),
        }
      }),

      findOne: vi.fn().mockImplementation((query: any, _projection?: any) => {
        let note: any = null
        if (query && query.nid !== undefined) {
          note = mockNotes.find((n) => n.nid === query.nid)
        } else if (query && query._id) {
          note = mockNotes.find(
            (n) => n._id === query._id || n.id === query._id,
          )
        } else if (!query || Object.keys(query).length === 0) {
          note =
            mockNotes.length > 0
              ? [...mockNotes].sort(
                  (a, b) =>
                    new Date(b.created).getTime() -
                    new Date(a.created).getTime(),
                )[0]
              : null
        }

        const chainable = {
          sort: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          lean: vi.fn().mockImplementation((_opts?: any) => {
            return note ? { ...note } : null
          }),
        }

        if (note) {
          return {
            ...createSaveableDocument({ ...note }),
            ...chainable,
          }
        }

        return chainable
      }),

      find: vi.fn().mockImplementation((_query: any) => {
        return mockNotes
      }),

      findOneAndUpdate: vi
        .fn()
        .mockImplementation(
          (queryParam: any, updateParam: any, _opts?: any) => {
            const note = mockNotes.find(
              (n) => n._id === queryParam._id || n.id === queryParam._id,
            )
            if (note) {
              Object.assign(note, updateParam)
              return {
                lean: vi.fn().mockReturnValue({ ...note }),
              }
            }
            return {
              lean: vi.fn().mockReturnValue(null),
            }
          },
        ),

      deleteOne: vi.fn().mockImplementation((query: any) => {
        const index = mockNotes.findIndex(
          (n) => n._id === query._id || n.id === query._id,
        )
        if (index !== -1) {
          mockNotes.splice(index, 1)
          return Promise.resolve({ deletedCount: 1 })
        }
        return Promise.resolve({ deletedCount: 0 })
      }),

      countDocuments: vi.fn().mockResolvedValue(mockNotes.length),

      updateOne: vi.fn().mockImplementation(() => ({
        exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      })),

      paginate: vi.fn().mockImplementation((query: any, options: any) => {
        const filtered = mockNotes.filter((n) => {
          if (query.topicId) {
            return n.topicId === query.topicId
          }
          return true
        })
        return Promise.resolve({
          docs: filtered,
          totalDocs: filtered.length,
          limit: options.limit || 10,
          page: options.page || 1,
          totalPages: Math.ceil(filtered.length / (options.limit || 10)),
        })
      }),
    }
  }

  beforeEach(async () => {
    mockComments = []

    mockFileReferenceService = {
      activateReferences: vi.fn().mockResolvedValue(undefined),
      updateReferencesForDocument: vi.fn().mockResolvedValue(undefined),
      removeReferencesForDocument: vi.fn().mockResolvedValue(undefined),
    }

    mockEventManager = {
      emit: vi.fn().mockResolvedValue(undefined),
      broadcast: vi.fn().mockResolvedValue(undefined),
    }

    mockCommentService = {
      model: {
        deleteMany: vi.fn().mockImplementation((query: any) => {
          if (query.ref) {
            const count = mockComments.filter((c) => c.ref === query.ref).length
            mockComments = mockComments.filter((c) => c.ref !== query.ref)
            return Promise.resolve({ deletedCount: count })
          }
          return Promise.resolve({ deletedCount: 0 })
        }),
      },
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

    mockDraftService = {
      markAsPublished: vi.fn().mockResolvedValue(undefined),
      linkToPublished: vi.fn().mockResolvedValue(undefined),
      deleteByRef: vi.fn().mockResolvedValue(undefined),
    }

    const mockNoteModel = createMockNoteModel()

    const module = await Test.createTestingModule({
      providers: [
        NoteService,
        {
          provide: getModelToken(NoteModel.name),
          useValue: mockNoteModel,
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
          provide: CommentService,
          useValue: mockCommentService,
        },
        {
          provide: TextMacroService,
          useValue: mockTextMacroService,
        },
        {
          provide: DraftService,
          useValue: mockDraftService,
        },
      ],
    }).compile()

    noteService = module.get<NoteService>(NoteService)
  })

  afterEach(() => {
    mockNotes = []
    mockComments = []
    vi.clearAllMocks()
  })

  describe('checkNoteIsSecret', () => {
    it('should return false when no publicAt', () => {
      const note = {
        publicAt: null,
      } as NoteModel

      const result = noteService.checkNoteIsSecret(note)

      expect(result).toBe(false)
    })

    it('should return true when publicAt is in future', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const note = {
        publicAt: futureDate,
      } as NoteModel

      const result = noteService.checkNoteIsSecret(note)

      expect(result).toBe(true)
    })

    it('should return false when publicAt is in past', () => {
      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 1)

      const note = {
        publicAt: pastDate,
      } as NoteModel

      const result = noteService.checkNoteIsSecret(note)

      expect(result).toBe(false)
    })
  })

  describe('getLatestNoteId', () => {
    it('should return latest note nid and id', async () => {
      mockNotes.push({
        _id: 'note-1',
        id: 'note-1',
        nid: 1,
        title: 'Note 1',
        created: new Date('2021-01-01'),
      })
      mockNotes.push({
        _id: 'note-2',
        id: 'note-2',
        nid: 2,
        title: 'Note 2',
        created: new Date('2021-01-02'),
      })

      const result = await noteService.getLatestNoteId()

      expect(result).toHaveProperty('nid')
      expect(result).toHaveProperty('id')
    })

    it('should throw CannotFindException when no notes', async () => {
      await expect(noteService.getLatestNoteId()).rejects.toThrow(
        CannotFindException,
      )
    })
  })

  describe('getLatestOne', () => {
    it('should return latest note with next reference', async () => {
      mockNotes.push({
        _id: 'note-1',
        id: 'note-1',
        nid: 1,
        title: 'Note 1',
        text: 'Content 1',
        created: new Date('2021-01-01'),
      })
      mockNotes.push({
        _id: 'note-2',
        id: 'note-2',
        nid: 2,
        title: 'Note 2',
        text: 'Content 2',
        created: new Date('2021-01-02'),
      })

      const result = await noteService.getLatestOne()

      expect(result).toBeDefined()
      expect(result?.latest).toBeDefined()
    })

    it('should return null when no notes', async () => {
      const result = await noteService.getLatestOne()

      expect(result).toBeNull()
    })

    it('should apply text macro replacement', async () => {
      mockNotes.push({
        _id: 'note-1',
        id: 'note-1',
        nid: 1,
        title: 'Note 1',
        text: 'Content with {{macro}}',
        created: new Date('2021-01-01'),
      })

      mockTextMacroService.replaceTextMacro.mockResolvedValue(
        'Content with replaced',
      )

      await noteService.getLatestOne()

      expect(mockTextMacroService.replaceTextMacro).toHaveBeenCalled()
    })
  })

  describe('checkPasswordToAccess', () => {
    it('should return true when no password set', () => {
      const note = {
        password: null,
      } as NoteModel

      const result = noteService.checkPasswordToAccess(note)

      expect(result).toBe(true)
    })

    it('should return false when password required but not provided', () => {
      const note = {
        password: 'secret123',
      } as NoteModel

      const result = noteService.checkPasswordToAccess(note)

      expect(result).toBe(false)
    })

    it('should return true when password matches', () => {
      const note = {
        password: 'secret123',
      } as NoteModel

      const result = noteService.checkPasswordToAccess(note, 'secret123')

      expect(result).toBe(true)
    })

    it('should return false when password does not match', () => {
      const note = {
        password: 'secret123',
      } as NoteModel

      const result = noteService.checkPasswordToAccess(note, 'wrongpassword')

      expect(result).toBe(false)
    })
  })

  describe('create', () => {
    it('should create note with valid data', async () => {
      const noteData = {
        title: 'Test Note',
        text: 'Test content',
      } as NoteModel

      const result = await noteService.create(noteData)

      expect(result).toBeDefined()
      expect(result.title).toBe('Test Note')
      expect(result.nid).toBeDefined()
    })

    it('should not allow future created date', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const noteData = {
        title: 'Test Note',
        text: 'Test content',
        created: futureDate,
      } as NoteModel

      const result = await noteService.create(noteData)

      expect(new Date(result.created).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should process draft when draftId provided', async () => {
      const noteData = {
        title: 'Test Note',
        text: 'Test content',
        draftId: 'draft-123',
      } as NoteModel & { draftId: string }

      await noteService.create(noteData)

      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalled()
      expect(mockDraftService.linkToPublished).toHaveBeenCalledWith(
        'draft-123',
        expect.any(String),
      )
      expect(mockDraftService.markAsPublished).toHaveBeenCalledWith('draft-123')
    })
  })

  describe('updateById', () => {
    beforeEach(() => {
      mockNotes.push({
        _id: 'note-1',
        id: 'note-1',
        nid: 1,
        title: 'Original Title',
        text: 'Original text',
        created: new Date('2021-01-01'),
        isPublished: true,
      })
    })

    it('should update note with valid data', async () => {
      const result = await noteService.updateById('note-1', {
        title: 'Updated Title',
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('Updated Title')
    })

    it('should throw NoContentCanBeModifiedException when not found', async () => {
      await expect(
        noteService.updateById('non-existent-id', { title: 'New Title' }),
      ).rejects.toThrow()
    })

    it('should update updated timestamp when specified fields change', async () => {
      const result = await noteService.updateById('note-1', {
        mood: 'happy',
      })

      expect((result as any).updated).toBeDefined()
    })

    it('should update modified timestamp when title/text changes', async () => {
      const result = await noteService.updateById('note-1', {
        text: 'Updated text',
      })

      expect(result.modified).toBeDefined()
    })

    it('should mark draft as published when draftId provided', async () => {
      await noteService.updateById('note-1', {
        title: 'Updated',
        draftId: 'draft-123',
      } as any)

      expect(mockDraftService.markAsPublished).toHaveBeenCalledWith('draft-123')
    })
  })

  describe('deleteById', () => {
    beforeEach(() => {
      mockNotes.push({
        _id: 'note-to-delete',
        id: 'note-to-delete',
        nid: 1,
        title: 'To Delete',
        text: 'Content',
      })

      mockComments.push({
        _id: 'comment-1',
        ref: 'note-to-delete',
        refType: 'Note',
      })
    })

    it('should delete note', async () => {
      await noteService.deleteById('note-to-delete')

      expect(mockNotes.find((n) => n._id === 'note-to-delete')).toBeUndefined()
    })

    it('should do nothing when note not found', async () => {
      await expect(
        noteService.deleteById('non-existent'),
      ).resolves.toBeUndefined()
    })

    it('should cascade delete comments', async () => {
      await noteService.deleteById('note-to-delete')

      expect(mockCommentService.model.deleteMany).toHaveBeenCalled()
    })

    it('should remove file references', async () => {
      await noteService.deleteById('note-to-delete')

      expect(
        mockFileReferenceService.removeReferencesForDocument,
      ).toHaveBeenCalledWith('note-to-delete', FileReferenceType.Note)
    })
  })

  describe('getIdByNid', () => {
    beforeEach(() => {
      mockNotes.push({
        _id: 'note-1',
        id: 'note-1',
        nid: 42,
        title: 'Note 42',
      })
    })

    it('should return _id for valid nid', async () => {
      const result = await noteService.getIdByNid(42)

      expect(result).toBe('note-1')
    })

    it('should return null for invalid nid', async () => {
      const result = await noteService.getIdByNid(999)

      expect(result).toBeNull()
    })
  })

  describe('findOneByIdOrNid', () => {
    beforeEach(() => {
      mockNotes.push({
        _id: '507f1f77bcf86cd799439011',
        id: '507f1f77bcf86cd799439011',
        nid: 1,
        title: 'Note 1',
      })
    })

    it('should find by MongoId when valid ObjectId', async () => {
      const result = await noteService.findOneByIdOrNid(
        '507f1f77bcf86cd799439011',
      )

      expect(result).toBeDefined()
    })

    it('should find by nid when not ObjectId', async () => {
      const result = await noteService.findOneByIdOrNid(1)

      expect(result).toBeDefined()
    })
  })
})
