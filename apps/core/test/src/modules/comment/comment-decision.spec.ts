import { readFileSync, writeFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type DecisionAnswer,
  listDecisionModels,
  requestDecision,
} from '~/modules/ai/decision/typesafe'
import { CommentSpamFilterService } from '~/modules/comment/comment.spam-filter'
import {
  commentDecisionQuestions,
  commentModeration,
  commentSubmissionStatus,
  resolveCommentDecision,
} from '~/modules/comment/comment-decision'

const choice = (choice: string, confidence = 1): DecisionAnswer => ({
  type: 'choice',
  choice,
  confidence,
  probabilities: {
    safe: choice === 'safe' ? 1 : 0,
    spam: choice === 'spam' ? 1 : 0,
  },
})
afterEach(() => vi.unstubAllGlobals())

describe('two-stage comment decisions', () => {
  it('accepts confident safe results, rejects any confident violation, and escalates ambiguity', () => {
    expect(
      resolveCommentDecision(
        { risk: choice('safe'), sensitive: choice('safe') },
        0.9,
        5,
      ),
    ).toBe('approved')
    expect(
      resolveCommentDecision(
        { risk: choice('safe'), sensitive: choice('safe', 0.5) },
        0.9,
        5,
      ),
    ).toBe('pending')
    expect(
      resolveCommentDecision(
        { risk: choice('safe', 0.2), sensitive: choice('sensitive') },
        0.9,
        5,
      ),
    ).toBe('rejected')
    expect(
      resolveCommentDecision(
        { risk: choice('spam'), sensitive: choice('safe', 0.2) },
        0.9,
        5,
      ),
    ).toBe('rejected')
    const risk: DecisionAnswer = {
      type: 'score',
      score: 4,
      confidence: 1,
      probabilities: { '4': 1 },
    }
    expect(
      resolveCommentDecision({ risk, sensitive: choice('safe') }, 0.9, 5),
    ).toBe('approved')
    expect(
      resolveCommentDecision(
        { risk: { ...risk, score: 4.1 }, sensitive: choice('safe') },
        0.9,
        5,
      ),
    ).toBe('rejected')
  })

  it('does not turn unread comments into published comments when human approval is required', () => {
    expect(
      commentSubmissionStatus({ state: 0, moderationStatus: 'approved' }, true),
    ).toBe('pending')
    expect(
      commentSubmissionStatus(
        { state: 0, moderationStatus: 'approved' },
        false,
      ),
    ).toBe('published')
    expect(
      commentSubmissionStatus(
        { state: 0, moderationStatus: 'approved', readerId: 'reader' },
        true,
      ),
    ).toBe('published')
    expect(
      commentSubmissionStatus({ state: 1, moderationStatus: 'pending' }, false),
    ).toBe('pending')
    expect(
      commentSubmissionStatus({ state: 1, moderationStatus: 'manual' }, false),
    ).toBe('pending')
  })

  it('names who holds a pending submission', () => {
    expect(
      commentModeration({ state: 0, moderationStatus: 'approved' }, false),
    ).toEqual({ status: 'published' })
    expect(
      commentModeration({ state: 0, moderationStatus: 'pending' }, false),
    ).toEqual({ status: 'pending', reviewer: 'ai' })
    expect(
      commentModeration({ state: 0, moderationStatus: 'manual' }, false),
    ).toEqual({ status: 'pending', reviewer: 'owner' })
    expect(
      commentModeration({ state: 0, moderationStatus: 'approved' }, true),
    ).toEqual({ status: 'pending', reviewer: 'owner' })
    expect(
      commentModeration({ state: 2, moderationStatus: 'rejected' }, false),
    ).toEqual({ status: 'rejected' })
  })

  it('validates upstream choices and probability distributions instead of trusting malformed success responses', async () => {
    const provider = { apiKey: 'test', defaultModel: 'jev-latest' }
    const questions = {
      risk: {
        type: 'choice' as const,
        instructions: 'Is it spam?',
        criteria: { safe: 'Safe', spam: 'Spam' },
      },
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ answers: { risk: choice('invented') } }),
          ),
        ),
    )
    await expect(
      requestDecision(provider, 'text', questions, AbortSignal.timeout(1000)),
    ).rejects.toThrow()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('private upstream response', { status: 401 }),
        ),
    )
    await expect(
      requestDecision(provider, 'text', questions, AbortSignal.timeout(1000)),
    ).rejects.toThrow('HTTP 401')
  })

  it('loads native Jev model names and rejects malformed model listings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [{ name: 'jev-latest' }] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [{ id: 'unexpected' }] })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(listDecisionModels({ apiKey: 'test' })).resolves.toEqual([
      { id: 'jev-latest', name: 'jev-latest' },
    ])
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.typesafe.ai/v1/models')
    await expect(listDecisionModels({ apiKey: 'test' })).rejects.toThrow()
  })

  it('skips AI for local rules and trusted readers, escalates decision failures, and propagates LLM failures', async () => {
    const decide = vi.fn().mockRejectedValue(new Error('timeout'))
    const config = {
      antiSpam: true,
      aiReview: true,
      decisionReview: true,
      decisionTimeoutMs: 100,
      aiReviewType: 'binary',
      aiReviewThreshold: 5,
      decisionConfidence: 0.9,
    }
    const service = new CommentSpamFilterService(
      { get: async () => config } as any,
      {} as any,
      {
        decide,
        getCommentReviewModel: async () => {
          throw new Error('LLM unavailable')
        },
      } as any,
    )
    expect(
      await service.initialReview(
        { text: '这篇文章解释得非常清楚，谢谢分享' },
        true,
      ),
    ).toBe('approved')
    expect(decide).not.toHaveBeenCalled()
    expect(
      await service.initialReview(
        { text: '这篇文章解释得非常清楚，谢谢分享' },
        false,
      ),
    ).toBe('pending')
    await expect(service.evaluateWithAI('hello', 'binary', 5)).rejects.toThrow(
      'LLM unavailable',
    )
  })
})

it.skipIf(!process.env.JEV_KEY_FILE)(
  'measures real Jev moderation decisions',
  async () => {
    const apiKey = readFileSync(process.env.JEV_KEY_FILE!, 'utf8').trim()
    const evidence: unknown[] = []
    for (const mode of ['binary', 'score'] as const) {
      for (const text of [
        '谢谢你的分享，这篇文章帮我理解了问题。',
        '加我微信领取博彩送彩金，稳赚不赔，点击链接立即充值！',
        '这做法真有意思。',
      ]) {
        const started = performance.now()
        const answers = await requestDecision(
          { apiKey, defaultModel: 'jev-latest' },
          { text },
          commentDecisionQuestions(mode),
          AbortSignal.timeout(10000),
        )
        evidence.push({
          mode,
          text,
          elapsedMs: Math.round(performance.now() - started),
          decision: resolveCommentDecision(answers, 0.9, 5),
          answers,
        })
        expect(Object.keys(answers)).toEqual(
          expect.arrayContaining(['risk', 'sensitive']),
        )
      }
    }
    if (process.env.JEV_EVIDENCE_FILE)
      writeFileSync(
        process.env.JEV_EVIDENCE_FILE,
        JSON.stringify(evidence, null, 2),
      )
  },
  60000,
)
