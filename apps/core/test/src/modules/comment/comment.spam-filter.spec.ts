import { describe, expect, it, vi } from 'vitest'

import { CommentSpamFilterService } from '~/modules/comment/comment.spam-filter'
import type { CommentModel } from '~/modules/comment/comment.types'

interface CommentOptionsLike {
  antiSpam: boolean
  aiReview: boolean
  aiReviewType: 'binary' | 'score'
  aiReviewThreshold: number
}

const baseDoc = (overrides?: Partial<CommentModel>): CommentModel =>
  ({
    text: 'hello world',
    author: 'visitor',
    ip: '127.0.0.1',
    ...overrides,
  }) as CommentModel

const buildService = (params: {
  options: CommentOptionsLike
  structuredOutput: Record<string, unknown>
}) => {
  const configsService = {
    get: vi.fn(async (key: string) => {
      if (key === 'commentOptions') return params.options
      return undefined
    }),
  }
  const ownerService = {
    getOwner: vi.fn(async () => ({ username: 'owner', name: 'Owner' })),
  }
  const runtime = {
    generateStructured: vi.fn(async () => ({ output: params.structuredOutput })),
  }
  const aiService = {
    getCommentReviewModel: vi.fn(async () => runtime),
  }
  const service = new CommentSpamFilterService(
    configsService as any,
    ownerService as any,
    aiService as any,
  )
  return { service, runtime }
}

describe('CommentSpamFilterService AI review', () => {
  it('flags comment as spam when hasSensitiveContent is true in score mode', async () => {
    const { service } = buildService({
      options: {
        antiSpam: true,
        aiReview: true,
        aiReviewType: 'score',
        aiReviewThreshold: 9,
      },
      structuredOutput: { score: 1, hasSensitiveContent: true },
    })

    const isSpam = await service.checkSpam(baseDoc())
    expect(isSpam).toBe(true)
  })

  it('flags comment as spam when hasSensitiveContent is true in binary mode', async () => {
    const { service } = buildService({
      options: {
        antiSpam: true,
        aiReview: true,
        aiReviewType: 'binary',
        aiReviewThreshold: 5,
      },
      structuredOutput: { isSpam: false, hasSensitiveContent: true },
    })

    const isSpam = await service.checkSpam(baseDoc())
    expect(isSpam).toBe(true)
  })

  it('keeps comment when both flags are false', async () => {
    const { service } = buildService({
      options: {
        antiSpam: true,
        aiReview: true,
        aiReviewType: 'binary',
        aiReviewThreshold: 5,
      },
      structuredOutput: { isSpam: false, hasSensitiveContent: false },
    })

    const isSpam = await service.checkSpam(baseDoc())
    expect(isSpam).toBe(false)
  })
})
