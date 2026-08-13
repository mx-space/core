import { AI_PROMPTS } from '../../ai.prompts'
import { Conversation } from '../../message-engine/conversation/conversation'
import type { TranslationUnit } from '../translation-unit.types'
import { unitsToEntries, unitsToMeta } from '../translation-unit.types'

export function createTranslationConversation(opts: {
  targetLang: string
  documentContext: string
  units: TranslationUnit[]
  styleHints?: string
  reviewEnabled: boolean
}): Conversation {
  const { targetLang, documentContext, units, styleHints, reviewEnabled } = opts
  const { systemPrompt } = AI_PROMPTS.translationAgent(targetLang, {
    reviewEnabled,
  })
  const { prompt } = AI_PROMPTS.translationChunk(targetLang, {
    documentContext,
    textEntries: unitsToEntries(units),
    segmentMeta: unitsToMeta(units),
    ...(styleHints ? { styleHints } : {}),
  })
  const conversation = new Conversation(systemPrompt)
  conversation.appendUser(prompt)
  return conversation
}
