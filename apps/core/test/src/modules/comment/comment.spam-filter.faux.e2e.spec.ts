import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'
import { CommentSpamFilterService } from '~/modules/comment/comment.spam-filter'

const PROVIDER_HOST = 'api.openai.com'
const PROVIDER_ID = 'openai'
const MODEL_ID = 'faux-spam-model'

function mountFaux(responses: ReturnType<typeof fauxAssistantMessage>[]) {
  return withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER_ID,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses,
  })
}

function buildService() {
  const runtime = new PiRuntimeAdapter({
    apiKey: 'k',
    endpoint: `https://${PROVIDER_HOST}/v1`,
    model: MODEL_ID,
    providerType: AIProviderType.OpenAICompatible,
    providerId: PROVIDER_ID,
  })
  const configsService = { get: vi.fn(async () => ({})) }
  const ownerService = {
    getOwner: vi.fn(async () => ({ username: 'admin', name: 'admin' })),
  }
  const aiService = { getCommentReviewModel: vi.fn(async () => runtime) }
  const service = new CommentSpamFilterService(
    configsService as any,
    ownerService as any,
    aiService as any,
  )
  return { service }
}

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

describe('CommentSpamFilterService faux e2e', () => {
  it('binary mode: hasSensitiveContent=true flags as spam', async () => {
    const handle = mountFaux([
      fauxAssistantMessage([
        fauxToolCall('structured_output', {
          isSpam: false,
          hasSensitiveContent: true,
        }),
      ]),
    ])
    torn.push(() => handle.teardown())
    const { service } = buildService()
    const result = await service.evaluateWithAI('innocent', 'binary', 5)
    expect(result).toBe(true)
  })

  it('binary mode: isSpam=true flags as spam (without sensitive content)', async () => {
    const handle = mountFaux([
      fauxAssistantMessage([
        fauxToolCall('structured_output', {
          isSpam: true,
          hasSensitiveContent: false,
        }),
      ]),
    ])
    torn.push(() => handle.teardown())
    const { service } = buildService()
    const result = await service.evaluateWithAI('spammy', 'binary', 5)
    expect(result).toBe(true)
  })

  it('binary mode: both false -> not spam', async () => {
    const handle = mountFaux([
      fauxAssistantMessage([
        fauxToolCall('structured_output', {
          isSpam: false,
          hasSensitiveContent: false,
        }),
      ]),
    ])
    torn.push(() => handle.teardown())
    const { service } = buildService()
    const result = await service.evaluateWithAI('benign', 'binary', 5)
    expect(result).toBe(false)
  })

  it('score mode: score above threshold flags as spam', async () => {
    const handle = mountFaux([
      fauxAssistantMessage([
        fauxToolCall('structured_output', {
          score: 9,
          hasSensitiveContent: false,
        }),
      ]),
    ])
    torn.push(() => handle.teardown())
    const { service } = buildService()
    const result = await service.evaluateWithAI('risky', 'score', 5)
    expect(result).toBe(true)
  })

  it('score mode: hasSensitiveContent shortcut still flags', async () => {
    const handle = mountFaux([
      fauxAssistantMessage([
        fauxToolCall('structured_output', {
          score: 1,
          hasSensitiveContent: true,
        }),
      ]),
    ])
    torn.push(() => handle.teardown())
    const { service } = buildService()
    const result = await service.evaluateWithAI('sensitive', 'score', 5)
    expect(result).toBe(true)
  })

  it('returns false on AI error (failure-path)', async () => {
    const handle = mountFaux([
      fauxAssistantMessage('boom', {
        stopReason: 'error',
        errorMessage: 'upstream down',
      }),
    ])
    torn.push(() => handle.teardown())
    const { service } = buildService()
    const result = await service.evaluateWithAI('anything', 'binary', 5)
    expect(result).toBe(false)
  })
})
