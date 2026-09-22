import { z } from 'zod'

import type { AIProviderConfig } from '../ai.types'

export type DecisionQuestion = {
  instructions: string
} & (
  | { type: 'choice'; criteria: Record<string, string> }
  | { type: 'score'; criteria: string[] }
)

const probability = z.number().min(0).max(1)
const answerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('choice'),
    choice: z.string(),
    confidence: probability,
    probabilities: z.record(z.string(), probability),
  }),
  z.object({
    type: z.literal('score'),
    score: z.number(),
    confidence: probability,
    probabilities: z.record(z.string(), probability),
  }),
])
export type DecisionAnswer = z.infer<typeof answerSchema>

export async function requestDecision(
  provider: Pick<AIProviderConfig, 'apiKey' | 'endpoint' | 'defaultModel'>,
  state: unknown,
  questions: Record<string, DecisionQuestion>,
  signal: AbortSignal,
): Promise<Record<string, DecisionAnswer>> {
  const endpoint = (provider.endpoint || 'https://api.typesafe.ai/v1').replace(
    /\/+$/,
    '',
  )
  const response = await fetch(`${endpoint}/systemone`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: provider.defaultModel, state, questions }),
    signal,
    redirect: 'error',
  })
  // Do not surface upstream bodies: they may contain credentials or comment text.
  if (!response.ok)
    throw new Error(`Decision request failed (HTTP ${response.status})`)
  const { answers } = z
    .object({ answers: z.record(z.string(), answerSchema) })
    .parse(await response.json())
  for (const [id, question] of Object.entries(questions)) {
    const answer = answers[id]
    if (!answer || answer.type !== question.type)
      throw new Error('Invalid decision answer')
    const keys =
      question.type === 'choice'
        ? Object.keys(question.criteria)
        : question.criteria.map((_, index) => String(index))
    if (
      Object.keys(answer.probabilities).length !== keys.length ||
      keys.some((key) => answer.probabilities[key] === undefined) ||
      Math.abs(
        Object.values(answer.probabilities).reduce((a, b) => a + b, 0) - 1,
      ) > 0.02
    )
      throw new Error('Invalid decision probabilities')
    if (answer.type === 'choice' && !keys.includes(answer.choice))
      throw new Error('Invalid decision choice')
    if (
      answer.type === 'score' &&
      (answer.score < 0 || answer.score > keys.length - 1)
    )
      throw new Error('Invalid decision score')
  }
  return answers
}

export async function listDecisionModels(
  provider: Pick<AIProviderConfig, 'apiKey' | 'endpoint'>,
) {
  const endpoint = (provider.endpoint || 'https://api.typesafe.ai/v1').replace(
    /\/+$/,
    '',
  )
  const response = await fetch(`${endpoint}/models`, {
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  })
  if (!response.ok)
    throw new Error(`Decision model list failed (HTTP ${response.status})`)
  const { models } = z
    .object({ models: z.array(z.object({ name: z.string().min(1) })) })
    .parse(await response.json())
  return models.map(({ name }) => ({ id: name, name }))
}
