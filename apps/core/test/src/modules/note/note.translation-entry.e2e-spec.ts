import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import type { TranslationEntryRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'

describe('note translation-entry collection', () => {
  it('collects note mood and weather dictionary values without Mongoose models', async () => {
    const entryRepository = createPgRepositoryMock<TranslationEntryRepository>()
    const noteService = {
      findDistinctMoodsAndWeathers: vi.fn().mockResolvedValue({
        moods: ['开心'],
        weathers: ['晴'],
      }),
    }
    const service = new TranslationEntryService(
      entryRepository as any,
      { findAllCategory: vi.fn().mockResolvedValue([]) } as any,
      noteService as any,
      { findAll: vi.fn().mockResolvedValue([]) } as any,
      {} as any,
      {} as any,
      { getClient: vi.fn() } as any,
    )

    await expect(service.collectSourceValues()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyPath: 'note.mood',
          keyType: 'dict',
          sourceText: '开心',
        }),
        expect.objectContaining({
          keyPath: 'note.weather',
          keyType: 'dict',
          sourceText: '晴',
        }),
      ]),
    )
  })
})
