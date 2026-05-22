import { describe, expect, it, vi } from 'vitest'

import { NoteController } from '~/modules/note/note.controller'

const makeNote = (overrides: Record<string, unknown> = {}) => ({
  id: 'note-1',
  title: 'Original Title',
  text: 'Original text',
  content: null,
  contentFormat: null,
  nid: 1,
  slug: null,
  mood: 'happy',
  weather: 'sunny',
  isPublished: true,
  createdAt: new Date('2026-01-01'),
  modifiedAt: null,
  location: null,
  coordinates: null,
  password: null,
  topic: null,
  meta: null,
  ...overrides,
})

const buildTranslationResult = (overrides: Record<string, unknown> = {}) => ({
  isTranslated: true,
  title: 'Translated Title',
  text: 'Translated text',
  content: null,
  contentFormat: null,
  sourceLang: 'zh',
  translationMeta: {
    sourceLang: 'zh',
    targetLang: 'en',
    translatedAt: new Date('2026-01-02'),
    model: 'claude-haiku',
  },
  availableTranslations: ['en', 'ja'],
  ...overrides,
})

const createController = (
  overrides: {
    noteService?: Record<string, unknown>
    translationService?: Record<string, unknown>
    translationEntryService?: Record<string, unknown>
    enrichmentService?: Record<string, unknown>
    countingService?: Record<string, unknown>
    aiInsightsService?: Record<string, unknown>
  } = {},
) => {
  const noteService = {
    create: vi.fn().mockResolvedValue({ id: 'note-1' }),
    updateById: vi.fn(),
    findOneByIdOrNid: vi.fn().mockResolvedValue({ id: 'note-1' }),
    deleteById: vi.fn(),
    publicNoteQueryCondition: { isPublished: true },
    findById: vi.fn().mockResolvedValue(makeNote()),
    checkNoteIsSecret: vi.fn().mockReturnValue(false),
    checkPasswordToAccess: vi.fn().mockResolvedValue(true),
    findByCreatedWindow: vi.fn().mockResolvedValue([]),
    getLatestOne: vi.fn().mockResolvedValue(null),
    listPaginated: vi.fn().mockResolvedValue({
      data: [],
      pagination: { currentPage: 1, size: 10, total: 0, totalPage: 1 },
    }),
    getNotePaginationByTopicId: vi.fn().mockResolvedValue({
      data: [],
      pagination: { currentPage: 1, size: 10, total: 0, totalPage: 1 },
    }),
    ...overrides.noteService,
  }

  const translationService = {
    translateArticle: vi.fn().mockResolvedValue({
      isTranslated: false,
      title: '',
      text: '',
    }),
    translateArticleList: vi.fn().mockResolvedValue(new Map()),
    collectArticleTranslations: vi.fn().mockResolvedValue({
      results: new Map(),
      meta: new Map(),
    }),
    ...overrides.translationService,
  }

  const translationEntryService = {
    getTranslationsBatch: vi.fn().mockResolvedValue({
      entityMaps: new Map(),
      dictMaps: new Map(),
    }),
    ...overrides.translationEntryService,
  }

  const enrichmentService = {
    attachEnrichments: vi
      .fn()
      .mockImplementation((note: any) =>
        Promise.resolve({ ...note, enrichments: {} }),
      ),
    ...overrides.enrichmentService,
  }

  const countingService = {
    getThisRecordIsLiked: vi.fn().mockResolvedValue(false),
    ...overrides.countingService,
  }

  const aiInsightsService = {
    hasInsightsInLang: vi.fn().mockResolvedValue(false),
    ...overrides.aiInsightsService,
  }

  const controller = new NoteController(
    noteService as any,
    countingService as any,
    translationService as any,
    {} as any,
    aiInsightsService as any,
    {} as any,
    enrichmentService as any,
    translationEntryService as any,
  )

  return {
    controller,
    noteService,
    translationService,
    translationEntryService,
    enrichmentService,
  }
}

describe('NoteController', () => {
  it('creates notes through the PG-backed NoteService', async () => {
    const { controller, noteService } = createController()

    await expect(
      controller.create({ title: 'Note', text: 'body' } as any),
    ).resolves.toEqual({ id: 'note-1' })
    expect(noteService.create).toHaveBeenCalledWith({
      title: 'Note',
      text: 'body',
    })
  })

  it('returns the refreshed note row after full modification', async () => {
    const { controller, noteService } = createController()

    await expect(
      controller.modify({ title: 'Updated' } as any, { id: 'note-1' }),
    ).resolves.toEqual({ id: 'note-1' })

    expect(noteService.updateById).toHaveBeenCalledWith('note-1', {
      title: 'Updated',
    })
    expect(noteService.findOneByIdOrNid).toHaveBeenCalledWith('note-1')
  })

  it('delegates publish status changes to NoteService updateById', async () => {
    const { controller, noteService } = createController()

    await expect(
      controller.setPublishStatus({ id: 'note-1' }, {
        isPublished: false,
      } as any),
    ).resolves.toEqual({ success: true })

    expect(noteService.updateById).toHaveBeenCalledWith('note-1', {
      isPublished: false,
    })
  })

  describe('GET /nid/:nid?lang=en — translation in place', () => {
    it('overwrites title/text/mood/weather in data and emits slim meta for current + next', async () => {
      const currentNote = makeNote({
        id: 'note-current',
        title: 'Original Title',
        text: 'Original text',
        mood: 'happy',
        weather: 'sunny',
        topic: {
          id: 'topic-1',
          name: 'Original Topic',
          introduce: '',
          description: '',
        },
      })
      const nextNote = makeNote({
        id: 'note-next',
        title: 'Next Original',
        text: 'Next text',
        mood: 'sad',
        weather: 'rainy',
        topic: {
          id: 'topic-1',
          name: 'Original Topic',
          introduce: '',
          description: '',
        },
      })

      const currentTranslationResult = buildTranslationResult({
        title: 'Translated Title',
        text: 'Translated text',
      })

      const moodDictMap = new Map([['happy', 'Happy (EN)']])
      const topicNameEntityMap = new Map([['topic-1', 'Translated Topic']])

      const { controller, enrichmentService } = createController({
        noteService: {
          findByNid: vi.fn().mockResolvedValue(currentNote),
          checkNoteIsSecret: vi.fn().mockReturnValue(false),
          checkPasswordToAccess: vi.fn().mockResolvedValue(true),
          findByCreatedWindow: vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([nextNote]),
        },
        translationService: {
          translateArticle: vi.fn().mockResolvedValue(currentTranslationResult),
          translateArticleList: vi.fn().mockResolvedValue(
            new Map([
              [
                'note-next',
                {
                  isTranslated: true,
                  title: 'Next Translated',
                  text: 'Next translated text',
                  content: null,
                  contentFormat: null,
                  sourceLang: 'zh',
                  translationMeta: {
                    sourceLang: 'zh',
                    targetLang: 'en',
                    translatedAt: new Date('2026-01-02'),
                    model: 'claude-haiku',
                  },
                  availableTranslations: ['en'],
                },
              ],
            ]),
          ),
        },
        translationEntryService: {
          getTranslationsBatch: vi.fn().mockResolvedValue({
            entityMaps: new Map([
              ['topic.name', topicNameEntityMap],
              ['topic.introduce', new Map()],
              ['topic.description', new Map()],
            ]),
            dictMaps: new Map([
              ['note.mood', moodDictMap],
              ['note.weather', new Map()],
            ]),
          }),
        },
      })

      const response = await controller.getNoteByNid(
        { nid: 1 } as any,
        false,
        {} as any,
        'fake-ip',
        'en',
      )

      expect(response.data.title).toBe('Translated Title')
      expect(response.data.text).toBe('Translated text')
      expect(response.data.mood).toBe('Happy (EN)')
      expect(response.data.topic.name).toBe('Translated Topic')

      expect(response.data.next.title).toBe('Next Translated')

      expect(
        response.meta.translation['note-current'].article.isTranslated,
      ).toBe(true)
      expect(response.meta.translation['note-current'].article.sourceLang).toBe(
        'zh',
      )
      expect(response.meta.translation['note-current'].article.targetLang).toBe(
        'en',
      )

      expect(response.meta.translation['note-next'].article.isTranslated).toBe(
        true,
      )

      expect(
        response.meta.translation['note-current'].article,
      ).not.toHaveProperty('title')
      expect(
        response.meta.translation['note-current'].article,
      ).not.toHaveProperty('text')

      const enrichedArg = (enrichmentService.attachEnrichments as any).mock
        .calls[0][0]
      expect(enrichedArg.title).toBe('Translated Title')
    })

    it('enrichment is called with already-translated data (pipeline order)', async () => {
      const note = makeNote({ id: 'note-order', title: 'ZH', text: 'ZH text' })
      const translationResult = buildTranslationResult({
        title: 'EN Title',
        text: 'EN text',
      })

      const { controller, enrichmentService } = createController({
        noteService: {
          findByNid: vi.fn().mockResolvedValue(note),
          checkNoteIsSecret: vi.fn().mockReturnValue(false),
          checkPasswordToAccess: vi.fn().mockResolvedValue(true),
          findByCreatedWindow: vi.fn().mockResolvedValue([]),
        },
        translationService: {
          translateArticle: vi.fn().mockResolvedValue(translationResult),
          translateArticleList: vi.fn().mockResolvedValue(new Map()),
        },
      })

      await controller.getNoteByNid(
        { nid: 1 } as any,
        false,
        {} as any,
        'fake-ip',
        'en',
      )

      const enrichedNote = (enrichmentService.attachEnrichments as any).mock
        .calls[0][0]
      expect(enrichedNote.title).toBe('EN Title')
      expect(enrichedNote.text).toBe('EN text')
    })
  })

  describe('GET /latest?lang=en — translation in place for latest + next', () => {
    it('translates latest and next in place with slim meta for both', async () => {
      const latestNote = makeNote({
        id: 'note-latest',
        title: 'Latest ZH',
        text: 'latest text',
      })
      const nextNote = makeNote({
        id: 'note-next-latest',
        title: 'Next ZH',
        text: 'next text',
      })

      const latestTranslation = buildTranslationResult({
        title: 'Latest EN',
        text: 'latest translated',
      })
      const nextTranslation = buildTranslationResult({
        title: 'Next EN',
        text: 'next translated',
      })

      const { controller } = createController({
        noteService: {
          getLatestOne: vi
            .fn()
            .mockResolvedValue({ latest: latestNote, next: nextNote }),
          checkNoteIsSecret: vi.fn().mockReturnValue(false),
        },
        translationService: {
          translateArticle: vi
            .fn()
            .mockResolvedValueOnce(latestTranslation)
            .mockResolvedValueOnce(nextTranslation),
        },
      })

      const response = await controller.getLatestOne(false, 'en')

      expect(response.data.title).toBe('Latest EN')
      expect(response.data.text).toBe('latest translated')
      expect(response.data.next.title).toBe('Next EN')
      expect(response.data.next.text).toBe('next translated')

      expect(
        response.meta.translation['note-latest'].article.isTranslated,
      ).toBe(true)
      expect(
        response.meta.translation['note-next-latest'].article.isTranslated,
      ).toBe(true)

      expect(
        response.meta.translation['note-latest'].article,
      ).not.toHaveProperty('title')
    })
  })

  describe('GET /?lang=en — list translation in place', () => {
    it('emits meta.translation only for translated items', async () => {
      const doc1 = makeNote({ id: 'list-1', title: 'ZH 1', text: 'text 1' })
      const doc2 = makeNote({ id: 'list-2', title: 'ZH 2', text: 'text 2' })
      const doc3 = makeNote({ id: 'list-3', title: 'ZH 3', text: 'text 3' })

      const translationMeta = new Map([
        [
          'list-1',
          {
            article: {
              isTranslated: true,
              sourceLang: 'zh',
              targetLang: 'en',
              availableTranslations: [],
            },
          },
        ],
        [
          'list-2',
          {
            article: {
              isTranslated: true,
              sourceLang: 'zh',
              targetLang: 'en',
              availableTranslations: [],
            },
          },
        ],
      ])

      const translationResults = new Map([
        [
          'list-1',
          { isTranslated: true, title: 'EN 1', text: 'translated text 1' },
        ],
        [
          'list-2',
          { isTranslated: true, title: 'EN 2', text: 'translated text 2' },
        ],
        ['list-3', { isTranslated: false, title: 'ZH 3', text: 'text 3' }],
      ])

      const { controller } = createController({
        noteService: {
          listPaginated: vi.fn().mockResolvedValue({
            data: [doc1, doc2, doc3],
            pagination: { currentPage: 1, size: 10, total: 3, totalPage: 1 },
          }),
        },
        translationService: {
          collectArticleTranslations: vi.fn().mockResolvedValue({
            results: translationResults,
            meta: translationMeta,
          }),
        },
      })

      const response = await controller.getNotes(
        false,
        { page: 1, size: 10 } as any,
        'en',
      )

      expect(response.data[0].title).toBe('EN 1')
      expect(response.data[1].title).toBe('EN 2')
      expect(response.data[2].title).toBe('ZH 3')

      expect(Object.keys(response.meta.translation)).toHaveLength(2)
      expect(response.meta.translation['list-1']).toBeDefined()
      expect(response.meta.translation['list-2']).toBeDefined()
      expect(response.meta.translation['list-3']).toBeUndefined()
    })
  })
})
