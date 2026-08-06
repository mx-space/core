import { LANGUAGE_CODE_TO_NAME } from '../../ai.constants'
import { AI_PROMPTS } from '../../ai.prompts'
import type { ContextInjector } from '../../message-engine/conversation/context-injector'
import type { TranslationUnit } from '../translation-unit.types'
import { unitsToEntries, unitsToMeta } from '../translation-unit.types'

export function translationContextInjectors(opts: {
  targetLang: string
  documentContext: string
  units: TranslationUnit[]
  styleHints?: string
  reviewEnabled: boolean
}): ContextInjector[] {
  const { targetLang, documentContext, units, styleHints, reviewEnabled } = opts
  const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
  const meta = unitsToMeta(units)
  return [
    {
      name: 'agent-system',
      position: 'system',
      build: () =>
        AI_PROMPTS.translationAgent(targetLang, { reviewEnabled }).systemPrompt,
    },
    {
      name: 'target-language',
      position: 'context',
      build: () => `TARGET_LANGUAGE: ${targetLanguage}`,
    },
    {
      name: 'document-context',
      position: 'context',
      build: () =>
        `## Document context (for semantic reference, DO NOT output this)\n${documentContext}`,
    },
    {
      name: 'style-context',
      position: 'context',
      build: () =>
        styleHints
          ? `## Style context (DO NOT output this)\n${styleHints}`
          : null,
    },
    {
      name: 'segment-meta',
      position: 'context',
      build: () =>
        Object.keys(meta).length > 0
          ? `## Segment metadata (for translation guidance only, DO NOT output this)\n${JSON.stringify(meta)}`
          : null,
    },
    {
      name: 'segments',
      position: 'context',
      build: () =>
        `## Segments to translate\n${JSON.stringify(unitsToEntries(units))}`,
    },
  ]
}
