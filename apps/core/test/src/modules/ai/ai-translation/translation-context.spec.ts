import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'
import { translationContextInjectors } from '~/modules/ai/ai-translation/engine/translation-context'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'
import {
  unitsToEntries,
  unitsToMeta,
} from '~/modules/ai/ai-translation/translation-unit.types'
import { buildPrefix } from '~/modules/ai/message-engine/conversation/context-injector'

const units: TranslationUnit[] = [
  { id: 'text:p1', payload: '你好', meta: 'text' },
  { id: '__title__', payload: '标题', meta: 'meta.title' },
]

describe('translationContextInjectors', () => {
  it('context message equals the legacy chunk prompt byte-for-byte', () => {
    const { contextMessage } = buildPrefix(
      translationContextInjectors({
        targetLang: 'ja',
        documentContext: 'DOC',
        units,
        styleHints: 'ARTICLE_TYPE: note',
        reviewEnabled: true,
      }),
    )
    const legacy = AI_PROMPTS.translationChunk('ja', {
      documentContext: 'DOC',
      textEntries: unitsToEntries(units),
      segmentMeta: unitsToMeta(units),
      styleHints: 'ARTICLE_TYPE: note',
    }).prompt
    expect(contextMessage).toBe(legacy)
  })

  it('omits the style block when styleHints is absent', () => {
    const { contextMessage } = buildPrefix(
      translationContextInjectors({
        targetLang: 'ja',
        documentContext: 'DOC',
        units,
        reviewEnabled: false,
      }),
    )
    expect(contextMessage).not.toContain('## Style context')
  })

  it('system prompt carries the agent-mode contract', () => {
    const { systemPrompt } = buildPrefix(
      translationContextInjectors({
        targetLang: 'ja',
        documentContext: 'DOC',
        units,
        reviewEnabled: true,
      }),
    )
    expect(systemPrompt).toContain('## Agent mode')
    expect(systemPrompt).toContain('request_review')
  })
})
