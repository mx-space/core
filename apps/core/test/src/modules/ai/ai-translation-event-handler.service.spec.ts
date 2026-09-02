import { describe, expect, it, vi } from 'vitest'

import { AiTranslationEventHandlerService } from '~/modules/ai/ai-translation/ai-translation-event-handler.service'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'

const createHandler = (options: { autoEntry?: boolean } = {}) => {
  const configService = {
    get: vi.fn().mockResolvedValue({
      enableTranslation: options.autoEntry ?? true,
      enableAutoGenerateTranslation: options.autoEntry ?? true,
    }),
  }
  const databaseService = {
    findGlobalById: vi.fn().mockResolvedValue({
      type: 'Post',
      document: { id: 'post-1', tags: ['机器学习', '', 'Rust'] },
    }),
  }
  const translationEntryService = {
    generateForValues: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  }
  const handler = new AiTranslationEventHandlerService(
    {} as any,
    configService as any,
    databaseService as any,
    translationEntryService as any,
  )
  return { handler, databaseService, translationEntryService }
}

describe('AiTranslationEventHandlerService post tags', () => {
  it('generates post.tag dictionary entries for every non-empty tag', async () => {
    const { handler, translationEntryService } = createHandler()

    await handler.handlePostTagEntry({ id: 'post-1' })

    expect(translationEntryService.generateForValues).toHaveBeenCalledWith([
      {
        keyPath: 'post.tag',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText('机器学习'),
        sourceText: '机器学习',
      },
      {
        keyPath: 'post.tag',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText('Rust'),
        sourceText: 'Rust',
      },
    ])
  })

  it('does nothing when auto entry generation is disabled', async () => {
    const { handler, databaseService, translationEntryService } = createHandler(
      { autoEntry: false },
    )

    await handler.handlePostTagEntry({ id: 'post-1' })

    expect(databaseService.findGlobalById).not.toHaveBeenCalled()
    expect(translationEntryService.generateForValues).not.toHaveBeenCalled()
  })

  it('skips posts without tags', async () => {
    const { handler, databaseService, translationEntryService } =
      createHandler()
    databaseService.findGlobalById.mockResolvedValue({
      type: 'Post',
      document: { id: 'post-1', tags: [] },
    })

    await handler.handlePostTagEntry({ id: 'post-1' })

    expect(translationEntryService.generateForValues).not.toHaveBeenCalled()
  })
})
