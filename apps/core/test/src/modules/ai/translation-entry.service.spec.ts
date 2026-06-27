import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import type { TranslationEntryRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'

const createService = () => {
  const repository = createPgRepositoryMock<TranslationEntryRepository>()
  const categoryService = { findAllCategory: vi.fn().mockResolvedValue([]) }
  const noteService = {
    findRecent: vi.fn().mockResolvedValue([]),
    findDistinctMoodsAndWeathers: vi
      .fn()
      .mockResolvedValue({ moods: [], weathers: [] }),
  }
  const topicRepository = { findAll: vi.fn().mockResolvedValue([]) }
  const aiService = {}
  const configService = {}
  const pipeline = {
    hset: vi.fn().mockReturnThis(),
    hdel: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  }
  const redis = {
    hmget: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(() => pipeline),
  }
  const redisService = { getClient: vi.fn(() => redis) }
  const service = new TranslationEntryService(
    repository as any,
    categoryService as any,
    noteService as any,
    topicRepository as any,
    aiService as any,
    configService as any,
    redisService as any,
  )
  return { noteService, pipeline, redis, repository, service }
}

describe('TranslationEntryService', () => {
  it('deduplicates entity lookup keys before querying the PG repository', async () => {
    const { repository, service } = createService()
    repository.listByBatch.mockResolvedValue([
      {
        keyType: 'entity',
        keyPath: 'category.name',
        lookupKey: 'cat-1',
        translatedText: 'Category',
      },
    ])

    const result = await service.getTranslations('category.name', 'en', [
      'cat-1',
      'cat-1',
      '',
    ])

    expect(repository.listByBatch).toHaveBeenCalledWith('en', [
      {
        keyPath: 'category.name',
        keyType: 'entity',
        lookupKeys: ['cat-1'],
      },
    ])
    expect(result.get('cat-1')).toBe('Category')
  })

  it('serves dictionary translations from Redis before falling back to PG rows', async () => {
    const { redis, repository, service } = createService()
    redis.hmget.mockResolvedValue(['Sunny'])

    const result = await service.getTranslationsForDict('note.weather', 'en', [
      '晴',
    ])

    expect(repository.listByBatch).not.toHaveBeenCalled()
    expect(result.get('晴')).toBe('Sunny')
  })

  it('seeds glossary entries from every distinct mood/weather across all visible notes', async () => {
    const { noteService, service } = createService() as any
    noteService.findDistinctMoodsAndWeathers.mockResolvedValue({
      moods: ['happy', 'sad'],
      weathers: ['sunny'],
    })

    const values = await service.collectSourceValues()

    expect(noteService.findDistinctMoodsAndWeathers).toHaveBeenCalledOnce()
    expect(noteService.findRecent).not.toHaveBeenCalled()
    const moods = values
      .filter((v: any) => v.keyPath === 'note.mood')
      .map((v: any) => v.sourceText)
    const weathers = values
      .filter((v: any) => v.keyPath === 'note.weather')
      .map((v: any) => v.sourceText)
    expect(moods.sort()).toEqual(['happy', 'sad'])
    expect(weathers).toEqual(['sunny'])
  })

  it('updates dictionary cache after PG dictionary entry updates', async () => {
    const { pipeline, repository, service } = createService()
    repository.updateTranslatedText.mockResolvedValue({
      keyType: 'dict',
      keyPath: 'note.mood',
      lang: 'en',
      lookupKey: 'hash-1',
      translatedText: 'Happy',
    })

    await service.updateEntry('entry-1', 'Happy')

    expect(pipeline.hset).toHaveBeenCalledWith(
      expect.any(String),
      'hash-1',
      'Happy',
    )
    expect(pipeline.exec).toHaveBeenCalled()
  })
})
