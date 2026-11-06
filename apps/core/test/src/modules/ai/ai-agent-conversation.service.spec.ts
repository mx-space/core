import { describe, expect, it } from 'vitest'

import { AiAgentConversationService } from '~/modules/ai/ai-agent/ai-agent-conversation.service'

describe('AiAgentConversationService.getDetail', () => {
  it('returns projected bubbles with review state and anchors', async () => {
    const repository = {
      findDetail: async () => ({
        id: '1',
        sessionId: 'post:1',
        model: 'm',
        providerId: 'p',
        title: null,
        createdAt: new Date(0),
        updatedAt: null,
        transcript: {
          known: {},
          messages: [{ role: 'user', content: 'hello', timestamp: 1 }],
        },
        reviewState: {
          reviewState: { batches: [] },
          anchors: [{ batchId: 'b1', toolCallId: 'c1' }],
        },
      }),
    }
    const service = new AiAgentConversationService(repository as any, {} as any)
    const detail = await service.getDetail('1')
    expect(detail.bubbles).toEqual([
      { type: 'user', content: 'hello' },
      { type: 'diff_review', batchId: 'b1' },
    ])
    expect(detail.reviewState).toEqual({ batches: [] })
    expect(detail.anchors).toEqual([{ batchId: 'b1', toolCallId: 'c1' }])
    expect(detail).not.toHaveProperty('transcript')
  })
})
