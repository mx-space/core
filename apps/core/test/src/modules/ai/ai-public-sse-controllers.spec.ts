import { describe, expect, it, vi } from 'vitest'

import type { AiStreamEvent } from '~/modules/ai/ai-inflight/ai-inflight.types'
import { AiInsightsController } from '~/modules/ai/ai-insights/ai-insights.controller'
import { AiSummaryController } from '~/modules/ai/ai-summary/ai-summary.controller'
import { AiTranslationController } from '~/modules/ai/ai-translation/ai-translation.controller'

// Public SSE wire format is byte-pinned per apps/core/CLAUDE.md:
//   event: token\ndata: <raw-text>\n\n
//   event: done\n\n
//   event: error\ndata: <json>\n\n
// Spec 2 widens the internal AiStreamEvent union with a 'partial' variant
// (for lexical typewriter UI). It MUST be filtered before reaching the wire.

function createMockReply() {
  const writes: string[] = []
  const reply: any = {
    raw: {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      writableEnded: false,
      write: (chunk: string) => {
        writes.push(chunk)
        return true
      },
      end: () => {
        reply.raw.writableEnded = true
      },
      on: vi.fn(),
    },
  }
  return {
    reply,
    bytes: () => writes.join(''),
  }
}

async function* eventStream(events: AiStreamEvent[]) {
  for (const ev of events) yield ev
}

const MIXED_EVENTS: AiStreamEvent[] = [
  { type: 'token', data: 'hello ' },
  {
    type: 'partial',
    data: {
      lang: 'en',
      segmentId: 'seg-1',
      partial: { translations: { 'seg-1': 'partial-text' } },
    },
  },
  { type: 'token', data: 'world' },
  {
    type: 'partial',
    data: { lang: 'en', partial: { foo: 'bar' }, done: true },
  },
  { type: 'done', data: { resultId: 'res-1' } },
]

describe('public SSE controllers — partial filter', () => {
  it('AiSummaryController.generateArticleSummary drops partial frames', async () => {
    const service: any = {
      streamSummaryForArticle: vi.fn(async () => ({
        events: eventStream(MIXED_EVENTS),
      })),
      getSummaryById: vi.fn(),
    }
    const taskService: any = { createSummaryTask: vi.fn() }
    const controller = new AiSummaryController(service, taskService)
    const cap = createMockReply()
    await controller.generateArticleSummary(
      { id: 'post-1' } as any,
      {} as any,
      cap.reply,
    )
    const bytes = cap.bytes()
    expect(bytes).not.toContain('event: partial')
    // step-26d: partial payload must not leak via stray data: lines either
    expect(bytes).not.toContain('partial-text')
    expect(bytes).not.toContain('"segmentId"')
    expect(bytes).not.toContain('"foo":"bar"')
    // Sanity: token + done frames preserved byte-for-byte
    expect(bytes).toContain('event: token\ndata: hello \n\n')
    expect(bytes).toContain('event: token\ndata: world\n\n')
    expect(bytes.endsWith('event: done\n\n')).toBe(true)
  })

  it('AiInsightsController.generateArticleInsights drops partial frames', async () => {
    const service: any = {
      streamInsightsForArticle: vi.fn(async () => ({
        events: eventStream(MIXED_EVENTS),
      })),
      getInsightsById: vi.fn(),
    }
    const taskService: any = { createInsightsTask: vi.fn() }
    const controller = new AiInsightsController(service, taskService)
    const cap = createMockReply()
    await controller.generateArticleInsights(
      { id: 'post-1' } as any,
      {} as any,
      cap.reply,
    )
    const bytes = cap.bytes()
    expect(bytes).not.toContain('event: partial')
    expect(bytes).toContain('event: token\ndata: hello \n\n')
    expect(bytes).toContain('event: token\ndata: world\n\n')
    expect(bytes.endsWith('event: done\n\n')).toBe(true)
  })

  it('AiTranslationController.streamArticleTranslation drops partial frames', async () => {
    const service: any = {
      streamTranslationForArticle: vi.fn(async () => ({
        events: eventStream(MIXED_EVENTS),
      })),
      getTranslationById: vi.fn(),
    }
    const taskService: any = { createTranslationTask: vi.fn() }
    const controller = new AiTranslationController(service, taskService)
    const cap = createMockReply()
    await controller.streamArticleTranslation(
      { id: 'post-1' } as any,
      { lang: 'zh' } as any,
      cap.reply,
    )
    const bytes = cap.bytes()
    expect(bytes).not.toContain('event: partial')
    expect(bytes).toContain('event: token\ndata: hello \n\n')
    expect(bytes).toContain('event: token\ndata: world\n\n')
    expect(bytes.endsWith('event: done\n\n')).toBe(true)
  })

  it('error frames remain wire-shaped after partial filter', async () => {
    const events: AiStreamEvent[] = [
      {
        type: 'partial',
        data: { lang: 'en', partial: {} },
      },
      { type: 'error', data: { message: 'boom' } },
    ]
    const service: any = {
      streamSummaryForArticle: vi.fn(async () => ({
        events: eventStream(events),
      })),
      getSummaryById: vi.fn(),
    }
    const taskService: any = { createSummaryTask: vi.fn() }
    const controller = new AiSummaryController(service, taskService)
    const cap = createMockReply()
    await controller.generateArticleSummary(
      { id: 'post-1' } as any,
      {} as any,
      cap.reply,
    )
    const bytes = cap.bytes()
    expect(bytes).not.toContain('event: partial')
    expect(bytes).toContain('event: error\ndata: {"message":"boom"}\n\n')
  })
})
