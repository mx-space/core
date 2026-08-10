import { describe, expect, it, vi } from 'vitest'

import { MultilangGenerationService } from '~/modules/ai/ai-multilang/ai-multilang.service'
import type { MultilangAdapter } from '~/modules/ai/ai-multilang/ai-multilang.types'

interface FakeDoc {
  id: string
  lang: string
  hash: string
  content: string
  isTranslation: boolean
  sourceLang: string | null
}

const createHarness = (overrides?: {
  adapter?: Partial<MultilangAdapter<{ text: string }, FakeDoc>>
}) => {
  const aiInFlightService = {
    runWithStream: vi.fn(async (opts: any) => {
      const { result } = await opts.onLeader({ push: async () => {} })
      return {
        events: (async function* () {})(),
        result: Promise.resolve(result),
      }
    }),
  }
  const generationMetrics = { record: vi.fn().mockResolvedValue(undefined) }
  const configService = {
    get: vi.fn().mockResolvedValue({ translationLangConcurrency: 2 }),
  }
  const service = new MultilangGenerationService(
    aiInFlightService as any,
    generationMetrics as any,
    configService as any,
  )

  const docs = new Map<string, FakeDoc>()
  const contentHash = service.computeContentHash('article text')
  const adapter: MultilangAdapter<{ text: string }, FakeDoc> = {
    feature: 'summary',
    assertEnabled: vi.fn(async () => {}),
    resolveArticle: vi.fn(async () => ({
      article: { text: 'article text' },
      text: 'article text',
      sourceLang: 'zh',
    })),
    generate: vi.fn(async (_article, lang) => ({
      content: `generated:${lang}`,
      usage: {},
      providerId: 'p',
      model: 'm',
    })),
    translate: vi.fn(async (sourceContent, targetLang) => ({
      content: `translated:${targetLang}:${sourceContent}`,
      usage: {},
      providerId: 'p',
      model: 'm',
    })),
    findById: vi.fn(async (id) => docs.get(id) ?? null),
    findBase: vi.fn(async () => null),
    findByRefAndLang: vi.fn(async () => null),
    persistBase: vi.fn(async (input) => {
      const doc: FakeDoc = {
        id: `base-${input.lang}`,
        lang: input.lang,
        hash: input.hash,
        content: input.content,
        isTranslation: false,
        sourceLang: input.lang,
      }
      docs.set(doc.id, doc)
      return doc
    }),
    persistTranslation: vi.fn(async (input) => {
      const doc: FakeDoc = {
        id: `tr-${input.lang}`,
        lang: input.lang,
        hash: input.hash,
        content: input.content,
        isTranslation: true,
        sourceLang: input.sourceLang,
      }
      docs.set(doc.id, doc)
      return doc
    }),
    deleteStaleTranslations: vi.fn(async () => 0),
    emitGenerated: vi.fn(),
    readDoc: (doc) => doc,
    ...overrides?.adapter,
  }

  const context = {
    taskId: 'task-1',
    isAborted: () => false,
    appendLog: vi.fn(),
    updateProgress: vi.fn(),
    setResult: vi.fn(),
    setStatus: vi.fn(),
    incrementTokens: vi.fn(),
    incrementCost: vi.fn(),
  }

  return {
    adapter,
    aiInFlightService,
    configService,
    context,
    contentHash,
    generationMetrics,
    service,
  }
}

describe('MultilangGenerationService.executeMultilangTask', () => {
  it('generates the base in the source language, then translates the remaining targets', async () => {
    const { adapter, context, service } = createHarness()

    const result = await service.executeMultilangTask(
      adapter,
      { refId: 'post-1', targetLanguages: ['en', 'ja', 'zh'] },
      context as any,
    )

    expect(adapter.generate).toHaveBeenCalledTimes(1)
    expect(adapter.generate).toHaveBeenCalledWith(
      expect.anything(),
      'zh',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
    expect(adapter.translate).toHaveBeenCalledTimes(2)
    expect(result.sourceLang).toBe('zh')
    expect(result.translated.map((t) => t.lang).sort()).toEqual(['en', 'ja'])
    expect(result.failedLangs).toEqual([])
  })

  it('reuses a base row whose hash matches the current content', async () => {
    const { adapter, context, contentHash, service } = createHarness()
    ;(adapter.findBase as any).mockResolvedValue({
      id: 'base-zh',
      lang: 'zh',
      hash: contentHash,
      content: 'generated:zh',
      isTranslation: false,
      sourceLang: 'zh',
    })

    await service.executeMultilangTask(
      adapter,
      { refId: 'post-1', targetLanguages: ['en'] },
      context as any,
    )

    expect(adapter.generate).not.toHaveBeenCalled()
    expect(adapter.translate).toHaveBeenCalledTimes(1)
  })

  it('regenerates a fresh base when forced, bypassing the result cache', async () => {
    const { adapter, aiInFlightService, context, contentHash, service } =
      createHarness()
    ;(adapter.findBase as any).mockResolvedValue({
      id: 'base-zh',
      lang: 'zh',
      hash: contentHash,
      content: 'generated:zh',
      isTranslation: false,
      sourceLang: 'zh',
    })

    await service.executeMultilangTask(
      adapter,
      { refId: 'post-1', force: true },
      context as any,
    )

    expect(adapter.generate).toHaveBeenCalledTimes(1)
    expect(aiInFlightService.runWithStream).toHaveBeenCalledWith(
      expect.objectContaining({ bypassResultCache: true }),
    )
  })

  it('invalidates stale translations when the base regenerates', async () => {
    const { adapter, context, service } = createHarness()

    await service.executeMultilangTask(
      adapter,
      { refId: 'post-1' },
      context as any,
    )

    expect(adapter.deleteStaleTranslations).toHaveBeenCalledWith(
      'post-1',
      expect.any(String),
    )
    expect(adapter.emitGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'base-zh' }),
      expect.objectContaining({ refId: 'post-1', sourceLang: 'zh' }),
    )
  })

  it('marks the task partially failed when one translation fails', async () => {
    const { adapter, context, service } = createHarness()
    ;(adapter.translate as any).mockImplementation(
      async (_source: string, targetLang: string) => {
        if (targetLang === 'ja') throw new Error('boom')
        return {
          content: `translated:${targetLang}`,
          usage: {},
          providerId: 'p',
          model: 'm',
        }
      },
    )

    const result = await service.executeMultilangTask(
      adapter,
      { refId: 'post-1', targetLanguages: ['en', 'ja'] },
      context as any,
    )

    expect(result.failedLangs).toEqual(['ja'])
    expect(result.translated.map((t) => t.lang)).toEqual(['en'])
    expect(context.setStatus).toHaveBeenCalledWith('partial_failed')
    expect(context.appendLog).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('ja'),
    )
  })
})

describe('MultilangGenerationService.runTranslation', () => {
  const base: FakeDoc = {
    id: 'base-zh',
    lang: 'zh',
    hash: 'hash-1',
    content: 'base content',
    isTranslation: false,
    sourceLang: 'zh',
  }

  it('short-circuits to the existing translation when its hash matches the base', async () => {
    const { adapter, aiInFlightService, service } = createHarness()
    ;(adapter.findByRefAndLang as any).mockResolvedValue({
      id: 'tr-en',
      lang: 'en',
      hash: 'hash-1',
      content: 'existing',
      isTranslation: true,
      sourceLang: 'zh',
    })

    const result = await service.runTranslation(adapter, {
      refId: 'post-1',
      base,
      targetLang: 'en',
    })

    expect(result.id).toBe('tr-en')
    expect(aiInFlightService.runWithStream).not.toHaveBeenCalled()
  })

  it('persists the translation with the base hash and source linkage', async () => {
    const { adapter, service } = createHarness()

    await service.runTranslation(adapter, {
      refId: 'post-1',
      base,
      targetLang: 'en',
    })

    expect(adapter.persistTranslation).toHaveBeenCalledWith({
      refId: 'post-1',
      lang: 'en',
      hash: 'hash-1',
      content: 'translated:en:base content',
      sourceId: 'base-zh',
      sourceLang: 'zh',
    })
  })

  it('derives the same in-flight key for repeated requests, force or not', async () => {
    const { adapter, aiInFlightService, service } = createHarness()

    await service.runTranslation(adapter, {
      refId: 'post-1',
      base,
      targetLang: 'en',
      force: true,
    })
    await service.runTranslation(adapter, {
      refId: 'post-1',
      base,
      targetLang: 'en',
      force: true,
    })

    const [first, second] = aiInFlightService.runWithStream.mock.calls.map(
      ([opts]: any[]) => opts.key,
    )
    expect(first).toBe(second)
  })
})
