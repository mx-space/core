import { describe, expect, it, vi } from 'vitest'

import { AiInsightsController } from '~/modules/ai/ai-insights/ai-insights.controller'
import { AiSummaryController } from '~/modules/ai/ai-summary/ai-summary.controller'

const createControllers = (sourceLang: string) => {
  const source = { id: 'source-1', lang: sourceLang, sourceLang }
  const taskService = {
    createSummaryTranslationTask: vi.fn(async () => ({ taskId: 't' })),
    createInsightsTranslationTask: vi.fn(async () => ({ taskId: 't' })),
  }
  const summary = new AiSummaryController(
    { findBaseSummaryForArticle: vi.fn(async () => source) } as any,
    taskService as any,
  )
  const insights = new AiInsightsController(
    { findSourceInsightsForArticle: vi.fn(async () => source) } as any,
    taskService as any,
  )
  return { insights, summary, taskService }
}

describe('translation task source language guard', () => {
  it('rejects a target sharing the source language and script', async () => {
    const { insights, summary } = createControllers('zh-CN')

    await expect(
      summary.createSummaryTranslationTask({
        refId: '1',
        targetLang: 'zh-SG',
      }),
    ).rejects.toThrow()
    await expect(
      insights.createInsightsTranslationTask({
        refId: '1',
        targetLang: 'zh-SG',
      }),
    ).rejects.toThrow()
  })

  it('accepts a target in another script of the source language', async () => {
    const { summary, taskService } = createControllers('zh')

    await summary.createSummaryTranslationTask({
      refId: '1',
      targetLang: 'zh-TW',
    })

    expect(taskService.createSummaryTranslationTask).toHaveBeenCalledWith(
      expect.objectContaining({ targetLang: 'zh-TW' }),
    )
  })
})
