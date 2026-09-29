import { describe, expect, it, vi } from 'vitest'

import { AiTranslationEventHandlerService } from '~/modules/ai/ai-translation/ai-translation-event-handler.service'

const createHandler = () => {
  const translationEntryService = {
    deleteByKeyPath: vi.fn(),
    generateForValues: vi.fn(),
    handleEntityUpdate: vi.fn(),
  }
  const handler = new AiTranslationEventHandlerService(
    {} as any,
    translationEntryService as any,
  )
  return { handler, translationEntryService }
}

describe('AiTranslationEventHandlerService entries', () => {
  it('marks a renamed category entry stale without generating a translation', async () => {
    const { handler, translationEntryService } = createHandler()

    await handler.handleCategoryUpdate({ id: 'cat-1', name: '技术' })

    expect(translationEntryService.handleEntityUpdate).toHaveBeenCalledWith(
      'category.name',
      'cat-1',
      '技术',
    )
    expect(translationEntryService.generateForValues).not.toHaveBeenCalled()
  })

  it('marks changed topic fields stale without generating translations', async () => {
    const { handler, translationEntryService } = createHandler()

    await handler.handleTopicUpdate({ id: 'topic-1', name: 'Electron' })

    expect(translationEntryService.handleEntityUpdate).toHaveBeenCalledTimes(1)
    expect(translationEntryService.generateForValues).not.toHaveBeenCalled()
  })
})
