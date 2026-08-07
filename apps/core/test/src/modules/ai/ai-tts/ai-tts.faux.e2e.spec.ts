import { createPgRepositoryMock, now } from 'test/helper/pg-repository-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode, createAppException } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import type { TtsTaskPayload } from '~/modules/ai/ai-task/ai-task.types'
import { toArticleContent } from '~/modules/ai/ai-translation/article-content.util'
import type { AiTtsRepository } from '~/modules/ai/ai-tts/ai-tts.repository'
import { AiTtsService } from '~/modules/ai/ai-tts/ai-tts.service'
import { computeSpeechFingerprint } from '~/modules/ai/ai-tts/tts-block-plan'
import {
  buildTtsObjectKey,
  computeTtsObjectFingerprint,
} from '~/modules/ai/ai-tts/tts-object-key'
import type { TaskExecuteContext } from '~/processors/task-queue'
import { TaskStatus } from '~/processors/task-queue'
import { computeContentHash } from '~/utils/content.util'

const { generateSpeechMock } = vi.hoisted(() => ({
  generateSpeechMock: vi.fn(),
}))

vi.mock('~/modules/ai/ai-tts/tts-runtime.adapter', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('~/modules/ai/ai-tts/tts-runtime.adapter')
    >()
  return {
    ...actual,
    TtsRuntimeAdapter: vi.fn(function (this: {
      generateSpeech: typeof generateSpeechMock
    }) {
      this.generateSpeech = generateSpeechMock
    }),
  }
})

const TEXT_A = 'first block text'
const TEXT_B = 'second block text'
const FP_A = computeSpeechFingerprint('paragraph', TEXT_A)
const FP_B = computeSpeechFingerprint('paragraph', TEXT_B)

const paragraph = (text: string) => ({
  type: 'paragraph',
  children: [{ type: 'text', text }],
})

const article = (modifiedAt = new Date('2026-01-01')) => ({
  type: CollectionRefTypes.Post,
  document: {
    id: '1',
    title: 'Narratable post',
    text: 'plain text',
    contentFormat: 'lexical',
    content: '{"root":{"children":[]}}',
    meta: { lang: 'zh-CN' },
    modifiedAt,
  },
})

// Mirrors how ai-translation.service.ts writes a row: the hash is computed with
// the very string that is then stored in sourceLang, so the fixture can never
// express a pairing the writer could not produce.
const translationRow = (overrides: Record<string, unknown> = {}) => {
  const sourceLang = (overrides.sourceLang as string) ?? 'zh'
  return {
    contentFormat: 'lexical',
    content: '{"root":{"children":[]}}',
    sourceLang,
    hash: computeContentHash(
      toArticleContent(article().document as never),
      sourceLang,
    ),
    sourceModifiedAt: new Date('2026-01-01'),
    createdAt: now,
    ...overrides,
  }
}

const PUBLISHED_VOICE = {
  model: 'published-model',
  voice: 'published-voice',
  speed: 1,
}

const objectKeyUnderVoice = (
  blockId: string,
  fingerprint: string,
  voice = PUBLISHED_VOICE,
) =>
  buildTtsObjectKey({
    refId: '1',
    lang: 'zh',
    blockId,
    chunkIndex: 0,
    fingerprint: computeTtsObjectFingerprint(fingerprint, voice),
  })

const blockRow = (
  blockId: string,
  fingerprint: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: `row-${blockId}`,
  createdAt: now,
  ttsId: 'tts-1',
  blockId,
  fingerprint,
  chunkIndex: 0,
  text: 'previously narrated',
  url: `https://cdn.example.com/${blockId}.mp3`,
  storageBackend: 's3' as const,
  storageKey: objectKeyUnderVoice(blockId, fingerprint),
  byteSize: 1,
  durationMs: null,
  ...overrides,
})

const parentRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'tts-1',
  createdAt: now,
  updatedAt: now,
  refId: '1',
  lang: 'zh',
  isTranslation: false,
  sourceLang: null,
  ...PUBLISHED_VOICE,
  format: 'mp3',
  blockOrder: ['blk-a', 'blk-b'],
  charCount: 10,
  totalDurationMs: null,
  sourceModifiedAt: new Date('2026-01-01'),
  ...overrides,
})

function baseTtsConfig() {
  return {
    enable: true,
    provider: 'openrouter',
    apiKey: 'test-api-key',
    endpoint: '',
    model: 'openai/gpt-4o-mini-tts',
    voice: 'alloy',
    speed: 1,
    maxCharsPerChunk: 1800,
    concurrency: 3,
    maxCharsPerRun: 120_000,
  }
}

function createTaskContext(
  overrides: Partial<TaskExecuteContext> = {},
): TaskExecuteContext {
  return {
    taskId: 'task-tts',
    signal: new AbortController().signal,
    updateProgress: vi.fn(),
    incrementTokens: vi.fn(),
    incrementCost: vi.fn(),
    appendLog: vi.fn(),
    setResult: vi.fn(),
    setStatus: vi.fn(),
    isAborted: () => false,
    streamPusher: vi.fn(),
    ...overrides,
  }
}

function createHarness() {
  const ttsConfig = baseTtsConfig()
  const configService = {
    get: vi.fn(async (key: string) => {
      if (key === 'ttsOptions') return ttsConfig
      if (key === 'imageStorageOptions') return { prefix: '' }
      return {}
    }),
  }

  const fileService = {
    uploadBuffer: vi.fn(
      async (_buffer: Buffer, opts: { objectKey: string }) => ({
        url: `https://cdn.example.com/${opts.objectKey}`,
        name: opts.objectKey.split('/').pop(),
        storageBackend: 's3' as const,
        storageKey: opts.objectKey,
      }),
    ),
    resolveFileUrl: vi.fn(
      async (type: string, name: string) =>
        `https://self.example.com/objects/${type}/${name}`,
    ),
    deleteObject: vi.fn(async () => {}),
  }

  const repository = createPgRepositoryMock<AiTtsRepository>()
  repository.findByRefAndLang.mockResolvedValue(null)
  repository.findBlocks.mockResolvedValue([])
  repository.upsertParent.mockImplementation(async (input: any) => ({
    ...parentRow(),
    ...input,
  }))
  repository.upsertBlock.mockImplementation(async (input: any) => ({
    ...blockRow(input.blockId, input.fingerprint),
    ...input,
  }))
  repository.deleteBlocksByIds.mockResolvedValue(undefined)

  const databaseService = { findGlobalById: vi.fn(async () => article()) }

  const lexicalService = {
    extractRootBlockNodes: vi.fn(() => [
      { id: 'blk-a', type: 'paragraph', node: paragraph(TEXT_A), index: 0 },
      { id: 'blk-b', type: 'paragraph', node: paragraph(TEXT_B), index: 1 },
    ]),
  }

  const translationRepository = { findByRefAndLang: vi.fn(async () => null) }

  const lockStore = new Map<string, string>()
  const redisClient = {
    set: vi.fn(async (key: string, value: string) => {
      if (lockStore.has(key)) return null
      lockStore.set(key, value)
      return 'OK'
    }),
    get: vi.fn(async (key: string) => lockStore.get(key) ?? null),
    del: vi.fn(async (key: string) => (lockStore.delete(key) ? 1 : 0)),
    expire: vi.fn(async () => 1),
    eval: vi.fn(
      async (script: string, _keys: number, key: string, token: string) => {
        if (lockStore.get(key) !== token) return 0
        if (script.includes('del')) lockStore.delete(key)
        return 1
      },
    ),
  }
  const redisService = { getClient: () => redisClient }

  let registered:
    | {
        execute: (
          payload: TtsTaskPayload,
          context: TaskExecuteContext,
        ) => Promise<void>
      }
    | undefined
  const taskProcessor = {
    registerHandler: vi.fn((handler) => {
      registered = handler
    }),
  }

  const service = new AiTtsService(
    configService as any,
    fileService as any,
    taskProcessor as any,
    repository as any,
    databaseService as any,
    lexicalService as any,
    translationRepository as any,
    redisService as any,
  )
  service.onModuleInit()

  return {
    ttsConfig,
    fileService,
    repository,
    databaseService,
    lexicalService,
    translationRepository,
    redis: redisClient,
    locks: lockStore,
    service,
    execute: (payload: TtsTaskPayload, context: TaskExecuteContext) =>
      registered!.execute(payload, context),
  }
}

type Harness = ReturnType<typeof createHarness>

describe('ai-tts generation task (faux e2e)', () => {
  let h: Harness
  let context: TaskExecuteContext

  beforeEach(() => {
    generateSpeechMock.mockReset()
    generateSpeechMock.mockResolvedValue({
      buffer: Buffer.from('audio-bytes'),
      mimeType: 'audio/mpeg',
    })
    h = createHarness()
    context = createTaskContext()
  })

  const publishedWith = (blocks: ReturnType<typeof blockRow>[]) => {
    h.repository.findByRefAndLang.mockResolvedValue(parentRow())
    h.repository.findBlocks.mockResolvedValue(blocks)
  }

  it('generates every block on the first run and publishes block order', async () => {
    await h.execute({ refId: '1' }, context)

    expect(generateSpeechMock).toHaveBeenCalledTimes(2)
    expect(h.repository.upsertBlock).toHaveBeenCalledTimes(2)
    expect(h.repository.upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({ blockOrder: ['blk-a', 'blk-b'] }),
    )
  })

  it('creates the parent with an empty block order before generating anything', async () => {
    await h.execute({ refId: '1' }, context)

    expect(h.repository.upsertParent.mock.calls[0][0]).toMatchObject({
      blockOrder: [],
      charCount: 0,
      sourceModifiedAt: null,
    })
    expect(h.repository.upsertParent.mock.invocationCallOrder[0]).toBeLessThan(
      h.repository.upsertBlock.mock.invocationCallOrder[0],
    )
  })

  it('regenerates only the edited block on the second run', async () => {
    publishedWith([blockRow('blk-a', FP_A), blockRow('blk-b', 'fp-b-old')])

    await h.execute({ refId: '1' }, context)

    expect(generateSpeechMock).toHaveBeenCalledTimes(1)
    expect(generateSpeechMock.mock.calls[0][0].input).toContain('second')
  })

  it('uploads audio with an explicit content-addressed object key', async () => {
    await h.execute({ refId: '1' }, context)

    expect(h.fileService.uploadBuffer).toHaveBeenCalledTimes(2)
    for (const [, opts] of h.fileService.uploadBuffer.mock.calls) {
      expect(opts.type).toBe('audio')
      expect(opts.objectKey).toMatch(
        /^tts\/1\/zh\/blk-[ab]-0-[\da-f]{12}\.mp3$/,
      )
    }
  })

  it('commits each chunk before the next one is generated', async () => {
    h.ttsConfig.concurrency = 1
    const order: string[] = []
    generateSpeechMock.mockImplementation(async () => {
      order.push('generate')
      return { buffer: Buffer.from('a'), mimeType: 'audio/mpeg' }
    })
    h.repository.upsertBlock.mockImplementation(async () => {
      order.push('commit')
      return {} as never
    })

    await h.execute({ refId: '1' }, context)

    expect(order).toEqual(['generate', 'commit', 'generate', 'commit'])
  })

  it('deletes displaced objects after the upsert, never before', async () => {
    publishedWith([blockRow('gone', 'fp-x')])

    await h.execute({ refId: '1' }, context)

    expect(h.repository.upsertBlock).toHaveBeenCalled()
    expect(h.fileService.deleteObject).toHaveBeenCalledWith(
      's3',
      objectKeyUnderVoice('gone', 'fp-x'),
    )
    expect(h.repository.upsertBlock.mock.invocationCallOrder[0]).toBeLessThan(
      h.fileService.deleteObject.mock.invocationCallOrder[0],
    )
  })

  it('deletes the object a regenerated chunk displaced, after its row is upserted', async () => {
    publishedWith([blockRow('blk-a', 'fp-a-old'), blockRow('blk-b', FP_B)])

    await h.execute({ refId: '1' }, context)

    expect(h.repository.deleteBlocksByIds).toHaveBeenCalledWith([])
    expect(h.fileService.deleteObject).toHaveBeenCalledWith(
      's3',
      objectKeyUnderVoice('blk-a', 'fp-a-old'),
    )
    expect(h.repository.upsertBlock.mock.invocationCallOrder[0]).toBeLessThan(
      h.fileService.deleteObject.mock.invocationCallOrder[0],
    )
  })

  it('survives a failing object deletion', async () => {
    publishedWith([blockRow('gone', 'fp-x')])
    h.fileService.deleteObject.mockRejectedValue(new Error('network'))

    await h.execute({ refId: '1' }, context)

    expect(context.setStatus).not.toHaveBeenCalled()
  })

  it('treats an already-written content-addressed object as a successful upload', async () => {
    h.fileService.uploadBuffer.mockRejectedValue(
      createAppException(AppErrorCode.FILE_EXISTS),
    )

    await h.execute({ refId: '1' }, context)

    expect(h.repository.upsertBlock).toHaveBeenCalledTimes(2)
    expect(h.repository.upsertBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        storageBackend: 'local',
        storageKey: expect.stringMatching(/^tts\/1\/zh\/blk-a-0-/),
        url: expect.stringContaining('/objects/audio/tts/1/zh/blk-a-0-'),
      }),
    )
    expect(context.setStatus).not.toHaveBeenCalled()
  })

  it('reports progress as a percentage', async () => {
    await h.execute({ refId: '1' }, context)

    const values = vi
      .mocked(context.updateProgress)
      .mock.calls.map((call) => call[0])
    expect(values.at(-1)).toBe(100)
    expect(values.every((value) => value >= 0 && value <= 100)).toBe(true)
  })

  it('skips a language whose lock is already held', async () => {
    h.redis.set.mockResolvedValue(null)

    await h.execute({ refId: '1', langs: ['zh'] }, context)

    expect(generateSpeechMock).not.toHaveBeenCalled()
    expect(h.repository.upsertParent).not.toHaveBeenCalled()
    expect(context.setStatus).not.toHaveBeenCalled()
  })

  it('releases the lock once the language finishes', async () => {
    await h.execute({ refId: '1' }, context)

    expect(h.redis.set).toHaveBeenCalledWith(
      'ai:tts:lock:1:zh',
      expect.any(String),
      'EX',
      300,
      'NX',
    )
    expect(h.locks.size).toBe(0)
  })

  it('releases the lock when the language fails', async () => {
    generateSpeechMock.mockRejectedValue(new Error('provider down'))

    await h.execute({ refId: '1' }, context)

    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.Failed)
    expect(h.locks.size).toBe(0)
  })

  it('settles every in-flight chunk before releasing the lock', async () => {
    h.ttsConfig.concurrency = 3
    let resolveSlow: (() => void) | undefined
    const slow = new Promise<void>((resolve) => {
      resolveSlow = resolve
    })
    generateSpeechMock
      .mockRejectedValueOnce(new Error('provider down'))
      .mockImplementationOnce(async () => {
        await slow
        return { buffer: Buffer.from('a'), mimeType: 'audio/mpeg' }
      })

    setTimeout(() => resolveSlow!(), 10)
    await h.execute({ refId: '1' }, context)

    expect(h.repository.upsertBlock).toHaveBeenCalledTimes(1)
    expect(h.locks.size).toBe(0)
  })

  it('skips the finalize when the article changed mid-run', async () => {
    publishedWith([])
    h.databaseService.findGlobalById
      .mockResolvedValueOnce(article(new Date('2026-01-01')))
      .mockResolvedValueOnce(article(new Date('2026-02-01')))

    await h.execute({ refId: '1' }, context)

    expect(h.repository.upsertBlock).toHaveBeenCalled()
    expect(h.repository.upsertParent).not.toHaveBeenCalled()
  })

  it('reports a mid-run source change as PartialFailed, never as a clean success', async () => {
    publishedWith([])
    h.databaseService.findGlobalById
      .mockResolvedValueOnce(article(new Date('2026-01-01')))
      .mockResolvedValueOnce(article(new Date('2026-02-01')))

    await h.execute({ refId: '1' }, context)

    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.PartialFailed)
    expect(vi.mocked(context.setResult).mock.calls[0][0]).toMatchObject({
      perLang: [expect.objectContaining({ requeued: true })],
    })
  })

  it('fails the language when the plan exceeds maxCharsPerRun', async () => {
    h.ttsConfig.maxCharsPerRun = 1

    await h.execute({ refId: '1' }, context)

    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.Failed)
    expect(generateSpeechMock).not.toHaveBeenCalled()
  })

  it('sets PartialFailed when one of two languages fails', async () => {
    await h.execute({ refId: '1', langs: ['zh', 'en'] }, context)

    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.PartialFailed)
  })

  it('narrates a translated language from its lexical translation row', async () => {
    h.translationRepository.findByRefAndLang.mockResolvedValue(translationRow())

    await h.execute({ refId: '1', langs: ['en'] }, context)

    expect(context.setStatus).not.toHaveBeenCalled()
    expect(h.repository.upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({ isTranslation: true, sourceLang: 'zh' }),
    )
  })

  it('narrates a fresh translation whose sourceLang carries a region subtag', async () => {
    h.translationRepository.findByRefAndLang.mockResolvedValue(
      translationRow({ sourceLang: 'zh-CN' }),
    )

    await h.execute({ refId: '1', langs: ['en'] }, context)

    expect(generateSpeechMock).toHaveBeenCalled()
    expect(context.setStatus).not.toHaveBeenCalled()
  })

  it('refuses to narrate a translation whose hash no longer matches the article', async () => {
    h.translationRepository.findByRefAndLang.mockResolvedValue(
      translationRow({ hash: 'hash-of-an-older-article' }),
    )

    await h.execute({ refId: '1', langs: ['en'] }, context)

    expect(generateSpeechMock).not.toHaveBeenCalled()
    expect(context.setStatus).toHaveBeenCalledWith(TaskStatus.Failed)
  })

  it('stamps a translated language with the translation vintage, not the article mtime', async () => {
    h.translationRepository.findByRefAndLang.mockResolvedValue(
      translationRow({ sourceModifiedAt: new Date('2025-06-01') }),
    )

    await h.execute({ refId: '1', langs: ['en'] }, context)

    expect(h.repository.upsertParent).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceModifiedAt: new Date('2025-06-01') }),
    )
  })

  it('canonicalizes and deduplicates the requested languages', async () => {
    await h.execute({ refId: '1', langs: ['zh-CN', 'zh'] }, context)

    expect(h.redis.set).toHaveBeenCalledTimes(1)
    expect(h.repository.upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'zh' }),
    )
  })

  it('rejects a task carrying more than eight languages', async () => {
    await expect(
      h.execute(
        {
          refId: '1',
          langs: ['en', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'ru', 'pt'],
        },
        context,
      ),
    ).rejects.toMatchObject({ code: AppErrorCode.AI_INVALID_PARAMETER })
  })

  it('throws TTS_DISABLED when the feature is off', async () => {
    h.ttsConfig.enable = false

    await expect(h.execute({ refId: '1' }, context)).rejects.toMatchObject({
      code: AppErrorCode.TTS_DISABLED,
    })
  })

  it('throws TTS_PROVIDER_NOT_CONFIGURED without an api key', async () => {
    h.ttsConfig.apiKey = ''

    await expect(h.execute({ refId: '1' }, context)).rejects.toMatchObject({
      code: AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED,
    })
  })

  it('pins the published voice config on an incremental run', async () => {
    publishedWith([blockRow('blk-a', 'fp-a-old'), blockRow('blk-b', FP_B)])

    await h.execute({ refId: '1' }, context)

    expect(generateSpeechMock.mock.calls[0][0].voice).toBe('published-voice')
    expect(h.repository.upsertParent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'published-model' }),
    )
  })

  it('regenerates a row whose object was written under another voice by a crashed force run', async () => {
    publishedWith([
      blockRow('blk-a', FP_A, {
        storageKey: objectKeyUnderVoice('blk-a', FP_A, {
          model: 'published-model',
          voice: 'nova',
          speed: 1,
        }),
      }),
      blockRow('blk-b', FP_B),
    ])

    await h.execute({ refId: '1' }, context)

    expect(generateSpeechMock).toHaveBeenCalledTimes(1)
    expect(generateSpeechMock.mock.calls[0][0].input).toContain('first')
    expect(generateSpeechMock.mock.calls[0][0].voice).toBe('published-voice')
    expect(h.repository.upsertBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'blk-a',
        storageKey: objectKeyUnderVoice('blk-a', FP_A),
      }),
    )
  })

  it('takes the current global voice config when forced', async () => {
    publishedWith([blockRow('blk-a', FP_A), blockRow('blk-b', FP_B)])

    await h.execute({ refId: '1', force: true }, context)

    expect(generateSpeechMock).toHaveBeenCalledTimes(2)
    expect(generateSpeechMock.mock.calls[0][0].voice).toBe('alloy')
  })

  it('a force run with a changed voice writes new object keys and displaces the old audio', async () => {
    await h.execute({ refId: '1' }, context)
    const alloyKeys = h.repository.upsertBlock.mock.calls.map(
      ([input]) => input.storageKey,
    )
    expect(alloyKeys).toHaveLength(2)

    const revoiced = createHarness()
    revoiced.ttsConfig.voice = 'nova'
    revoiced.repository.findByRefAndLang.mockResolvedValue(
      parentRow({ voice: 'alloy' }),
    )
    revoiced.repository.findBlocks.mockResolvedValue([
      blockRow('blk-a', FP_A, { storageKey: alloyKeys[0] }),
      blockRow('blk-b', FP_B, { storageKey: alloyKeys[1] }),
    ])

    await revoiced.execute({ refId: '1', force: true }, createTaskContext())

    const novaKeys = revoiced.repository.upsertBlock.mock.calls.map(
      ([input]) => input.storageKey,
    )
    expect(novaKeys).toHaveLength(2)
    for (const key of novaKeys) expect(alloyKeys).not.toContain(key)
    for (const key of alloyKeys) {
      expect(revoiced.fileService.deleteObject).toHaveBeenCalledWith('s3', key)
    }
  })
})
