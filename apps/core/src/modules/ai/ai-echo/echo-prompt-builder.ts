import type { RecentlyRow } from '../../recently/recently.types'
import { AI_PERSONA_PROMPTS } from '../ai-persona/prompts'
import type { ChatMessage, EchoPromptInput } from './scenario.types'

const NO_UNVERIFIED_MEMORY_RULE =
  'Do NOT claim to remember the author\'s past ("you wrote", "back when", "I remember", "我记得").'

export function buildRecentlyEchoPrompt(
  input: EchoPromptInput<RecentlyRow>,
): ChatMessage[] {
  const personaKey = input.persona.key
  const userContent = input.subject?.content ?? ''

  if (personaKey === 'passerby') {
    return [
      { role: 'system', content: AI_PERSONA_PROMPTS.passerby },
      { role: 'user', content: userContent },
    ]
  }

  const sections: string[] = [AI_PERSONA_PROMPTS.innerSelf]

  if (input.profile) {
    const summary =
      input.profile.profileSummary?.trim() || input.profile.profile.trim()
    if (summary) {
      sections.push('', 'Voice summary:', summary)
    }
  }

  if (input.exemplars.length) {
    sections.push('', 'Mimic the cadence of these passages:')
    input.exemplars.forEach((ex, i) => {
      sections.push(`${i + 1}. ${ex.content}`)
    })
  }

  if (input.memories.length) {
    sections.push('', 'Canonical facts (apply only if relevant):')
    input.memories.forEach((mem) => {
      sections.push(`- ${mem.content}`)
    })
  }

  if (input.retrieval.length) {
    sections.push(
      '',
      'Relevant past thoughts (reference only if directly applicable):',
    )
    input.retrieval.forEach((ret) => {
      sections.push(`[${ret.sourceType}:${ret.sourceId}] ${ret.content}`)
    })
  }

  const rules: string[] = ['', 'RULES:', '- Reply in 1–3 short sentences.']
  if (input.retrieval.length === 0 && input.memories.length === 0) {
    rules.push(`- ${NO_UNVERIFIED_MEMORY_RULE}`)
  }
  rules.push("- Match the author's first-person voice.")
  rules.push('- Plain markdown only; no code fences.')

  sections.push(...rules)

  return [
    { role: 'system', content: sections.join('\n') },
    { role: 'user', content: userContent },
  ]
}
