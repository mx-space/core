import { AI_PROMPTS } from '../../ai.prompts'
import { Conversation } from '../../message-engine/conversation/conversation'
import type { TranslationUnit } from '../translation-unit.types'
import { unitsToEntries, unitsToMeta } from '../translation-unit.types'
import type { TranslationChunk } from './translation-chunk-planner'

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

export function createTranslationCoordinatorConversation(opts: {
  targetLang: string
  chunks: readonly TranslationChunk[]
  reviewEnabled: boolean
}): Conversation {
  const { targetLang, chunks, reviewEnabled } = opts
  const reviewWorkflow = reviewEnabled
    ? 'After every chunk is complete, call request_review. If it reports issues, read only the cited ids with read_translation_segments, patch them, and request review again. Finish after a clean review or when the review budget is exhausted.'
    : 'After every chunk is complete, finish with a short confirmation.'
  const conversation =
    new Conversation(`You coordinate a long-document translation into ${targetLang}.

Do not translate prose yourself. The source text is intentionally hidden from this conversation. Delegate work through translate_chunks, which runs isolated translation sub-agents with bounded concurrency.

Call translate_chunks with all pending chunk ids. If any chunk fails, retry only the failed ids. Use translation_status when coverage is uncertain. Never invent chunk ids.

${reviewWorkflow}`)
  conversation.appendUser(`Translate every chunk in this manifest:
${JSON.stringify(
  chunks.map((chunk) => ({
    id: chunk.id,
    sourceChars: chunk.sourceChars,
    segmentCount: chunk.segmentCount,
  })),
)}`)
  return conversation
}
