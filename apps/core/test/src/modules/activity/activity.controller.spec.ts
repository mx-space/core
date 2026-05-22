import { describe, expect, it, vi } from 'vitest'

import { ActivityController } from '~/modules/activity/activity.controller'

const NOW = new Date('2024-01-01')

const TRANSLATED_TITLE_RESULT = {
  isTranslated: true,
  title: 'Translated Title',
  text: '',
  sourceLang: 'zh',
  translationMeta: {
    sourceLang: 'zh',
    targetLang: 'en',
    translatedAt: new Date('2024-06-01'),
    model: 'claude-haiku-4-5',
  },
  availableTranslations: ['en'],
}

const UNTRANSLATED_RESULT = {
  isTranslated: false,
  title: 'Original Title',
  text: '',
  sourceLang: 'zh',
  availableTranslations: [],
}

const makeTranslationMeta = () => ({
  article: {
    isTranslated: true,
    sourceLang: 'zh',
    targetLang: 'en',
    translatedAt: new Date('2024-06-01'),
    model: 'claude-haiku-4-5',
    availableTranslations: ['en'],
  },
})

const createController = (opts: {
  rooms?: {
    roomInfo?: { rooms: string[]; roomCount: Record<string, number> }
    objects?: Record<string, any[]>
  }
  readings?: Array<{ refId: string; ref?: any; count: number }>
  recent?: {
    likeData?: any[]
    comment?: any[]
    recentPublish?: { post: any[]; note: any[]; recent: any[] }
  }
  lastYearPublication?: { posts: any[]; notes: any[] }
  collectTranslations?: (
    opts: any,
  ) => Promise<{ results: Map<string, any>; meta: Map<string, any> }>
}) => {
  const defaultCollect = async () => ({
    results: new Map<string, any>(),
    meta: new Map<string, any>(),
  })

  const activityService = {
    getAllRoomNames: vi.fn(
      async () => opts.rooms?.roomInfo ?? { rooms: [], roomCount: {} },
    ),
    getRefsFromRoomNames: vi.fn(async () => ({
      objects: opts.rooms?.objects ?? {},
    })),
    getTopReadings: vi.fn(async () => opts.readings ?? []),
    getDateRangeOfReadings: vi.fn(async () => opts.readings ?? []),
    getLikeActivities: vi.fn(async () => ({
      data: opts.recent?.likeData ?? [],
    })),
    getRecentComment: vi.fn(async () => opts.recent?.comment ?? []),
    getRecentPublish: vi.fn(
      async () =>
        opts.recent?.recentPublish ?? { post: [], note: [], recent: [] },
    ),
    getLastYearPublication: vi.fn(
      async () => opts.lastYearPublication ?? { posts: [], notes: [] },
    ),
    likeAndEmit: vi.fn(),
    updatePresence: vi.fn(),
    getRoomPresence: vi.fn(async () => []),
    deleteActivityByType: vi.fn(),
    deleteAll: vi.fn(),
    getLikeActivitiesById: vi.fn(),
    getReadDurationActivities: vi.fn(async () => []),
  }

  const translationService = {
    collectArticleTranslations: vi.fn(
      opts.collectTranslations ?? defaultCollect,
    ),
  }

  const readerService = {
    findReaderInIds: vi.fn(async () => []),
  }

  const controller = new ActivityController(
    activityService as any,
    readerService as any,
    translationService as any,
  )

  return { controller, activityService, translationService }
}

describe('ActivityController.getRoomsInfo', () => {
  it('returns bare data when lang is absent', async () => {
    const { controller } = createController({
      rooms: {
        roomInfo: { rooms: ['room1'], roomCount: { room1: 1 } },
        objects: { post: [{ id: 'p1', title: 'Post 1', createdAt: NOW }] },
      },
    })

    const res = await controller.getRoomsInfo(undefined)
    expect(res).not.toHaveProperty('meta')
    expect((res as any).objects.post[0].title).toBe('Post 1')
  })

  it('translates titles in place across multiple type keys and emits meta only for translated items', async () => {
    const post1 = { id: 'p1', title: 'Post 1', createdAt: NOW }
    const post2 = { id: 'p2', title: 'Post 2', createdAt: NOW }
    const note1 = { id: 'n1', title: 'Note 1', createdAt: NOW }

    const { controller } = createController({
      rooms: {
        roomInfo: {
          rooms: ['r1', 'r2', 'r3'],
          roomCount: { r1: 1, r2: 1, r3: 1 },
        },
        objects: {
          post: [post1, post2],
          note: [note1],
        },
      },
      collectTranslations: async () => ({
        results: new Map([
          ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Post 1 EN' }],
          ['p2', { ...UNTRANSLATED_RESULT, title: 'Post 2' }],
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Note 1 EN' }],
        ]),
        meta: new Map([
          ['p1', makeTranslationMeta()],
          ['n1', makeTranslationMeta()],
        ]),
      }),
    })

    const res = await controller.getRoomsInfo('en')
    expect(res).toHaveProperty('meta')
    const d = (res as any).data
    expect(d.objects.post[0].title).toBe('Post 1 EN')
    expect(d.objects.post[1].title).toBe('Post 2')
    expect(d.objects.note[0].title).toBe('Note 1 EN')

    expect((res as any).meta.translation['p1']).toBeDefined()
    expect((res as any).meta.translation['n1']).toBeDefined()
    expect((res as any).meta.translation['p2']).toBeUndefined()
  })

  it('returns bare data when no items are translated', async () => {
    const { controller } = createController({
      rooms: {
        roomInfo: { rooms: ['r1'], roomCount: { r1: 1 } },
        objects: { post: [{ id: 'p1', title: 'Post 1', createdAt: NOW }] },
      },
      collectTranslations: async () => ({
        results: new Map([['p1', UNTRANSLATED_RESULT]]),
        meta: new Map(),
      }),
    })

    const res = await controller.getRoomsInfo('en')
    expect(res).not.toHaveProperty('meta')
  })
})

describe('ActivityController.getTopReadings', () => {
  it('returns bare data when lang is absent', async () => {
    const { controller } = createController({
      readings: [
        {
          refId: 'r1',
          ref: { id: 'r1', title: 'Article 1', createdAt: NOW, slug: 'a1' },
          count: 10,
        },
      ],
    })

    const res = await controller.getTopReadings({} as any, undefined)
    expect(Array.isArray(res)).toBe(true)
    expect((res as any[])[0].ref.title).toBe('Article 1')
  })

  it('translates ref.title in place and meta is keyed by refId', async () => {
    const { controller } = createController({
      readings: [
        {
          refId: 'ref-001',
          ref: {
            id: 'doc-001',
            title: 'Japanese Article',
            createdAt: NOW,
            slug: 'ja',
          },
          count: 5,
        },
        {
          refId: 'ref-002',
          ref: {
            id: 'doc-002',
            title: 'English Article',
            createdAt: NOW,
            slug: 'en',
          },
          count: 3,
        },
      ],
      collectTranslations: async () => ({
        results: new Map([
          [
            'ref-001',
            { ...TRANSLATED_TITLE_RESULT, title: 'Japanese Article EN' },
          ],
          ['ref-002', { ...UNTRANSLATED_RESULT, title: 'English Article' }],
        ]),
        meta: new Map([['ref-001', makeTranslationMeta()]]),
      }),
    })

    const res = await controller.getTopReadings({} as any, 'en')
    expect(res).toHaveProperty('meta')
    const d = (res as any).data
    expect(d[0].ref.title).toBe('Japanese Article EN')
    expect(d[1].ref.title).toBe('English Article')
    expect((res as any).meta.translation['ref-001']).toBeDefined()
    expect((res as any).meta.translation['ref-002']).toBeUndefined()
  })

  it('returns bare data when no items are translated', async () => {
    const { controller } = createController({
      readings: [
        {
          refId: 'ref-001',
          ref: { id: 'doc-001', title: 'Article', createdAt: NOW, slug: 'a' },
          count: 1,
        },
      ],
      collectTranslations: async () => ({
        results: new Map([['ref-001', UNTRANSLATED_RESULT]]),
        meta: new Map(),
      }),
    })

    const res = await controller.getTopReadings({} as any, 'en')
    expect(res).not.toHaveProperty('meta')
  })
})

describe('ActivityController.getReadingRangeRank', () => {
  it('meta keyed by refId when translated', async () => {
    const { controller } = createController({
      readings: [
        {
          refId: 'r1',
          ref: { id: 'd1', title: 'Title', createdAt: NOW, slug: 't' },
          count: 2,
        },
      ],
      collectTranslations: async () => ({
        results: new Map([
          ['r1', { ...TRANSLATED_TITLE_RESULT, title: 'Title EN' }],
        ]),
        meta: new Map([['r1', makeTranslationMeta()]]),
      }),
    })

    const res = await controller.getReadingRangeRank({} as any, 'en')
    expect((res as any).meta.translation['r1']).toBeDefined()
    expect((res as any).data[0].ref.title).toBe('Title EN')
  })
})

describe('ActivityController.getRecentActivities', () => {
  it('returns bare data when lang is absent', async () => {
    const { controller } = createController({
      recent: {
        likeData: [],
        comment: [],
        recentPublish: {
          post: [{ id: 'p1', title: 'P1', createdAt: NOW }],
          note: [],
          recent: [],
        },
      },
    })

    const res = await controller.getRecentActivities(undefined)
    expect(res).not.toHaveProperty('meta')
    expect((res as any).post[0].title).toBe('P1')
  })

  it('translates each bucket in place and aggregates meta', async () => {
    const likeItem = {
      id: 'like1',
      createdAt: NOW,
      ref: { title: 'Liked Post', slug: 'lp' },
      payload: { id: 'article-001' },
    }

    const collectMock = vi
      .fn()
      .mockResolvedValueOnce({
        results: new Map([
          [
            'article-001',
            { ...TRANSLATED_TITLE_RESULT, title: 'Liked Post EN' },
          ],
        ]),
        meta: new Map([['article-001', makeTranslationMeta()]]),
      })
      .mockResolvedValueOnce({
        results: new Map([
          ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Post EN' }],
        ]),
        meta: new Map([['p1', makeTranslationMeta()]]),
      })
      .mockResolvedValueOnce({
        results: new Map([
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Note EN' }],
        ]),
        meta: new Map([['n1', makeTranslationMeta()]]),
      })

    const { controller } = createController({
      recent: {
        likeData: [likeItem],
        comment: [],
        recentPublish: {
          post: [
            {
              id: 'p1',
              title: 'Post',
              createdAt: NOW,
              slug: 'p',
              modifiedAt: null,
            },
          ],
          note: [{ id: 'n1', title: 'Note', createdAt: NOW, modifiedAt: null }],
          recent: [],
        },
      },
      collectTranslations: collectMock,
    })

    const res = await controller.getRecentActivities('en')
    expect(res).toHaveProperty('meta')
    const d = (res as any).data
    expect(d.like[0].title).toBe('Liked Post EN')
    expect(d.post[0].title).toBe('Post EN')
    expect(d.note[0].title).toBe('Note EN')
    expect((res as any).meta.translation['article-001']).toBeDefined()
    expect((res as any).meta.translation['p1']).toBeDefined()
    expect((res as any).meta.translation['n1']).toBeDefined()
  })

  it('deletes articleId from like items before returning', async () => {
    const likeItem = {
      id: 'like1',
      createdAt: NOW,
      ref: { title: 'Post', slug: 'p' },
      payload: { id: 'art1' },
    }

    const { controller } = createController({
      recent: {
        likeData: [likeItem],
        comment: [],
        recentPublish: { post: [], note: [], recent: [] },
      },
      collectTranslations: async () => ({
        results: new Map(),
        meta: new Map(),
      }),
    })

    const res = await controller.getRecentActivities('en')
    const likeItems = (res as any).like
    expect(likeItems[0]).not.toHaveProperty('articleId')
  })

  it('returns bare data when no buckets have translations', async () => {
    const { controller } = createController({
      recent: {
        likeData: [],
        comment: [],
        recentPublish: {
          post: [{ id: 'p1', title: 'Post', createdAt: NOW }],
          note: [],
          recent: [],
        },
      },
      collectTranslations: async () => ({
        results: new Map([['p1', UNTRANSLATED_RESULT]]),
        meta: new Map(),
      }),
    })

    const res = await controller.getRecentActivities('en')
    expect(res).not.toHaveProperty('meta')
  })
})

describe('ActivityController.getLastYearPublication', () => {
  it('returns raw result when lang is absent', async () => {
    const { controller } = createController({
      lastYearPublication: {
        posts: [{ id: 'p1', title: 'Post', createdAt: NOW }],
        notes: [],
      },
    })

    const res = await controller.getLastYearPublication(undefined)
    expect(res).not.toHaveProperty('meta')
  })

  it('translates posts and notes in place and emits per-item meta', async () => {
    const { controller } = createController({
      lastYearPublication: {
        posts: [
          { id: 'p1', title: 'Post 1', createdAt: NOW },
          { id: 'p2', title: 'Post 2', createdAt: NOW },
        ],
        notes: [
          { id: 'n1', title: 'Note 1', createdAt: NOW },
          { id: 'n2', title: 'Private note', createdAt: NOW },
        ],
      },
      collectTranslations: vi
        .fn()
        .mockResolvedValueOnce({
          results: new Map([
            ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Post 1 EN' }],
            ['p2', { ...UNTRANSLATED_RESULT }],
          ]),
          meta: new Map([['p1', makeTranslationMeta()]]),
        })
        .mockResolvedValueOnce({
          results: new Map([
            ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Note 1 EN' }],
          ]),
          meta: new Map([['n1', makeTranslationMeta()]]),
        }),
    })

    const res = await controller.getLastYearPublication('en')
    expect(res).toHaveProperty('meta')
    const d = (res as any).data
    expect(d.posts[0].title).toBe('Post 1 EN')
    expect(d.posts[1].title).toBe('Post 2')
    expect(d.notes[0].title).toBe('Note 1 EN')
    expect(d.notes[1].title).toBe('Private note')

    expect((res as any).meta.translation['p1']).toBeDefined()
    expect((res as any).meta.translation['n1']).toBeDefined()
    expect((res as any).meta.translation['p2']).toBeUndefined()
  })

  it('does not translate private notes', async () => {
    const collectMock = vi
      .fn()
      .mockResolvedValueOnce({ results: new Map(), meta: new Map() })
      .mockResolvedValueOnce({ results: new Map(), meta: new Map() })

    const { controller, translationService } = createController({
      lastYearPublication: {
        posts: [],
        notes: [{ id: 'n1', title: 'Private note', createdAt: NOW }],
      },
      collectTranslations: collectMock,
    })

    await controller.getLastYearPublication('en')
    const noteSnapshots =
      translationService.collectArticleTranslations.mock.calls[1]?.[0]
        ?.articles ?? []
    expect(noteSnapshots).toHaveLength(0)
  })

  it('returns bare data when no items are translated', async () => {
    const { controller } = createController({
      lastYearPublication: {
        posts: [{ id: 'p1', title: 'Post', createdAt: NOW }],
        notes: [],
      },
      collectTranslations: vi
        .fn()
        .mockResolvedValueOnce({
          results: new Map([['p1', UNTRANSLATED_RESULT]]),
          meta: new Map(),
        })
        .mockResolvedValueOnce({ results: new Map(), meta: new Map() }),
    })

    const res = await controller.getLastYearPublication('en')
    expect(res).not.toHaveProperty('meta')
  })
})
