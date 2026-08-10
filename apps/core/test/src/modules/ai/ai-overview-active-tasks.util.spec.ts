import { describe, expect, it } from 'vitest'

import { toActiveGenerations } from '~/modules/ai/ai-overview/ai-overview-active-tasks.util'
import { AITaskType } from '~/modules/ai/ai-task/ai-task.types'

const task = (
  type: string,
  payload: Record<string, unknown>,
  id = 't1',
  status = 'running',
) => ({ id, type, status, payload })

describe('toActiveGenerations', () => {
  it('ignores tasks for other articles', () => {
    const result = toActiveGenerations(
      [task(AITaskType.Summary, { refId: 'other', targetLanguages: ['en'] })],
      '300',
    )

    expect(result).toEqual([])
  })

  it('maps a summary task to its target languages', () => {
    const result = toActiveGenerations(
      [
        task(AITaskType.Summary, {
          refId: '300',
          targetLanguages: ['en', 'ja'],
        }),
      ],
      '300',
    )

    expect(result).toMatchObject([
      {
        capability: 'summary',
        langs: ['en', 'ja'],
        status: 'running',
        taskId: 't1',
      },
    ])
  })

  it('reports an empty language list when the request left targets to config', () => {
    const result = toActiveGenerations(
      [task(AITaskType.Translation, { refId: '300' })],
      '300',
    )

    expect(result[0].langs).toEqual([])
  })

  it('maps the base insights task and its translation variant onto insights', () => {
    const result = toActiveGenerations(
      [
        task(AITaskType.Insights, { refId: '300' }, 'base'),
        task(
          AITaskType.InsightsTranslation,
          { refId: '300', targetLang: 'en' },
          'trans',
        ),
      ],
      '300',
    )

    expect(result).toMatchObject([
      { capability: 'insights', langs: [], status: 'running', taskId: 'base' },
      {
        capability: 'insights',
        langs: ['en'],
        status: 'running',
        taskId: 'trans',
      },
    ])
  })

  it('matches a batch translation through its refIds list', () => {
    const result = toActiveGenerations(
      [
        task(AITaskType.TranslationBatch, {
          refIds: ['100', '300'],
          targetLanguages: ['ko'],
        }),
      ],
      '300',
    )

    expect(result).toMatchObject([
      {
        capability: 'translation',
        langs: ['ko'],
        status: 'running',
        taskId: 't1',
      },
    ])
  })

  it('skips the all-articles translation task', () => {
    const result = toActiveGenerations(
      [task(AITaskType.TranslationAll, { targetLanguages: ['en'] })],
      '300',
    )

    expect(result).toEqual([])
  })

  it('maps a tts task through its langs field', () => {
    const result = toActiveGenerations(
      [task(AITaskType.Tts, { refId: '300', langs: ['zh'] })],
      '300',
    )

    expect(result[0]).toMatchObject({ capability: 'tts', langs: ['zh'] })
  })

  it('carries progress fields through', () => {
    const result = toActiveGenerations(
      [
        {
          id: 't1',
          type: AITaskType.Translation,
          status: 'running',
          payload: { refId: '300', targetLanguages: ['en'] },
          progress: 42,
          progressMessage: 'translating block 3',
          completedItems: 3,
          totalItems: 7,
          startedAt: 1_700_000_000_000,
        },
      ],
      '300',
    )

    expect(result[0]).toMatchObject({
      progress: 42,
      progressMessage: 'translating block 3',
      completedItems: 3,
      totalItems: 7,
      startedAt: 1_700_000_000_000,
    })
  })

  it('nulls out progress fields the queue did not report', () => {
    const result = toActiveGenerations(
      [task(AITaskType.Tts, { refId: '300', langs: ['zh'] })],
      '300',
    )

    expect(result[0]).toMatchObject({
      progress: null,
      progressMessage: null,
      completedItems: null,
      totalItems: null,
      startedAt: null,
    })
  })

  it('tolerates a missing payload', () => {
    const result = toActiveGenerations(
      [{ id: 't1', type: AITaskType.Summary, status: 'pending' }],
      '300',
    )

    expect(result).toEqual([])
  })
})
