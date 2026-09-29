import { describe, expect, it } from 'vitest'

import {
  normalizeTaskAiResources,
  parsePublishAiChoices,
  toPublishAiRequests,
} from './publish-ai-choices'

describe('publish AI choices', () => {
  it('restores remembered choices and ignores unknown values', () => {
    expect(
      parsePublishAiChoices(
        JSON.stringify({ insights: 'async', summary: 'sync', tts: 'later' }),
      ),
    ).toEqual({
      insights: 'async',
      summary: 'sync',
      translation: 'none',
      tts: 'none',
    })
    expect(parsePublishAiChoices('{broken').summary).toBe('none')
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
