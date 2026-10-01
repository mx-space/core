import { describe, expect, it } from 'vitest'

import {
  choicesFromRequests,
  normalizeTaskAiResources,
  toPublishAiRequests,
} from './publish-ai-choices'

describe('publish AI choices', () => {
  it('restores the remembered requests as choices', () => {
    expect(
      choicesFromRequests([
        { mode: 'async', resource: 'insights' },
        { mode: 'sync', resource: 'summary' },
      ]),
    ).toEqual({
      insights: 'async',
      summary: 'sync',
      translation: 'none',
      tts: 'none',
    })
    expect(choicesFromRequests(null).summary).toBe('none')
  })

  it('submits only chosen and available resources in a stable order', () => {
    expect(
      toPublishAiRequests(
        {
          insights: 'async',
          summary: 'sync',
          translation: 'async',
          tts: 'sync',
        },
        (resource) => resource !== 'tts',
      ),
    ).toEqual([
      { mode: 'sync', resource: 'summary' },
      { mode: 'async', resource: 'insights' },
      { mode: 'async', resource: 'translation' },
    ])
  })

  it('reads legacy task payload resources as sync', () => {
    expect(
      normalizeTaskAiResources(['summary', { mode: 'async', resource: 'tts' }]),
    ).toEqual([
      { mode: 'sync', resource: 'summary' },
      { mode: 'async', resource: 'tts' },
    ])
  })
})
