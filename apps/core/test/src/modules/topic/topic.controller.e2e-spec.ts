import { describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import type { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { TopicBaseController } from '~/modules/topic/topic.controller'

const makeEntryMaps = (
  entityMaps: Record<string, Record<string, string>> = {},
) => ({
  entityMaps: new Map(
    Object.entries(entityMaps).map(([k, v]) => [k, new Map(Object.entries(v))]),
  ),
  dictMaps: new Map(),
})

const createController = (
  entryMapsOverride?: ReturnType<typeof makeEntryMaps>,
) => {
  const defaultEntryMaps = makeEntryMaps()
  const translationEntryService: Pick<
    TranslationEntryService,
    'getTranslationsBatch'
  > = {
    getTranslationsBatch: vi
      .fn()
      .mockResolvedValue(entryMapsOverride ?? defaultEntryMaps),
  }

  const topics = [
    {
      id: 'topic-1',
      name: 'Original Name 1',
      introduce: 'Intro 1',
      description: 'Desc 1',
    },
    {
      id: 'topic-2',
      name: 'Original Name 2',
      introduce: 'Intro 2',
      description: 'Desc 2',
    },
  ]

  const repository = {
    findAll: vi.fn().mockResolvedValue(topics.map((t) => ({ ...t }))),
    findBySlug: vi.fn().mockResolvedValue({ ...topics[0], slug: 'hello' }),
    findById: vi.fn().mockResolvedValue({ ...topics[0] }),
    list: vi.fn().mockResolvedValue({ data: [], pagination: {} }),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  }

  return {
    controller: new TopicBaseController(
      repository as any,
      translationEntryService as unknown as TranslationEntryService,
    ),
    repository,
    translationEntryService,
  }
}

describe('TopicBaseController', () => {
  it('normalizes topic slugs before repository lookup', async () => {
    const { controller, repository } = createController()

    await expect(
      controller.getTopicByTopic({ slug: 'Hello Topic' } as any),
    ).resolves.toMatchObject({ id: 'topic-1', slug: 'hello' })

    expect(repository.findBySlug).toHaveBeenCalledWith('Hello-Topic')
  })

  it('throws when the PG repository cannot resolve the topic slug', async () => {
    const { controller, repository } = createController()
    repository.findBySlug.mockResolvedValue(null)

    await expect(
      controller.getTopicByTopic({ slug: 'missing' } as any),
    ).rejects.toThrow(AppException)
  })

  describe('GET /all with lang', () => {
    it('overwrites name/introduce/description in place for each topic', async () => {
      const entryMaps = makeEntryMaps({
        'topic.name': {
          'topic-1': 'Translated Name 1',
          'topic-2': 'Translated Name 2',
        },
        'topic.introduce': { 'topic-1': 'Translated Intro 1' },
        'topic.description': { 'topic-2': 'Translated Desc 2' },
      })
      const { controller } = createController(entryMaps)

      const result = await controller.getAll('en')

      expect(result).toEqual([
        expect.objectContaining({
          id: 'topic-1',
          name: 'Translated Name 1',
          introduce: 'Translated Intro 1',
          description: 'Desc 1',
        }),
        expect.objectContaining({
          id: 'topic-2',
          name: 'Translated Name 2',
          introduce: 'Intro 2',
          description: 'Translated Desc 2',
        }),
      ])
    })

    it('preserves original values when no entry exists', async () => {
      const { controller } = createController(makeEntryMaps())

      const result = await controller.getAll('en')

      expect((result as any[])[0]).toMatchObject({
        name: 'Original Name 1',
        introduce: 'Intro 1',
        description: 'Desc 1',
      })
    })

    it('returns no meta.translation block', async () => {
      const { controller } = createController()
      const result = await controller.getAll('en')

      expect(result).not.toHaveProperty('meta')
      expect(Array.isArray(result)).toBe(true)
    })

    it('does not call getTranslationsBatch when lang is absent', async () => {
      const { controller, translationEntryService } = createController()

      await controller.getAll(undefined)

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })

  describe('GET /:id with lang', () => {
    it('overwrites name/introduce/description in place', async () => {
      const entryMaps = makeEntryMaps({
        'topic.name': { 'topic-1': 'EN Name' },
        'topic.introduce': { 'topic-1': 'EN Intro' },
        'topic.description': { 'topic-1': 'EN Desc' },
      })
      const { controller } = createController(entryMaps)

      const result = await controller.get({ id: 'topic-1' } as any, 'en')

      expect(result).toMatchObject({
        name: 'EN Name',
        introduce: 'EN Intro',
        description: 'EN Desc',
      })
    })

    it('preserves original value when entry is missing', async () => {
      const { controller } = createController(makeEntryMaps())

      const result = await controller.get({ id: 'topic-1' } as any, 'en')

      expect(result).toMatchObject({ name: 'Original Name 1' })
    })

    it('does not call getTranslationsBatch when lang is absent', async () => {
      const { controller, translationEntryService } = createController()

      await controller.get({ id: 'topic-1' } as any, undefined)

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })

  describe('GET /slug/:slug with lang', () => {
    it('overwrites fields in place', async () => {
      const entryMaps = makeEntryMaps({
        'topic.name': { 'topic-1': 'EN Slug Name' },
      })
      const { controller } = createController(entryMaps)

      const result = await controller.getTopicByTopic(
        { slug: 'hello' } as any,
        'en',
      )

      expect(result).toMatchObject({ name: 'EN Slug Name' })
    })

    it('does not call getTranslationsBatch when lang is absent', async () => {
      const { controller, translationEntryService } = createController()

      await controller.getTopicByTopic({ slug: 'hello' } as any, undefined)

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })
})
