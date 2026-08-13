import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'
import { createTranslationConversation } from '~/modules/ai/ai-translation/engine/translation-context'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'
import {
  unitsToEntries,
  unitsToMeta,
} from '~/modules/ai/ai-translation/translation-unit.types'

const units: TranslationUnit[] = [
  { id: 'text:p1', payload: '你好', meta: 'text' },
  { id: '__title__', payload: '标题', meta: 'meta.title' },
]

describe('createTranslationConversation', () => {
  it('context message equals the legacy chunk prompt byte-for-byte', () => {
    const conversation = createTranslationConversation({
      targetLang: 'ja',
      documentContext: 'DOC',
      units,
      styleHints: 'ARTICLE_TYPE: note',
      reviewEnabled: true,
    })
    const legacy = AI_PROMPTS.translationChunk('ja', {
      documentContext: 'DOC',
      textEntries: unitsToEntries(units),
      segmentMeta: unitsToMeta(units),
      styleHints: 'ARTICLE_TYPE: note',
    }).prompt
    expect(conversation.messages[0]).toMatchObject({
      role: 'user',
      content: legacy,
    })
  })

  it('omits the style block when styleHints is absent', () => {
    const conversation = createTranslationConversation({
      targetLang: 'ja',
      documentContext: 'DOC',
      units,
      reviewEnabled: false,
    })
    expect(JSON.stringify(conversation.messages[0])).not.toContain(
      '## Style context',
    )
  })

  it('system prompt carries the agent-mode contract', () => {
    const conversation = createTranslationConversation({
      targetLang: 'ja',
      documentContext: 'DOC',
      units,
      reviewEnabled: true,
    })
    expect(conversation.systemPrompt).toContain('## Agent mode')
    expect(conversation.systemPrompt).toContain('request_review')
  })
})
