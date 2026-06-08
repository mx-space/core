import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import type {
  AiTranslationRepository,
  AiTranslationRow,
} from '~/modules/ai/ai-translation/ai-translation.repository'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const row = (overrides: Partial<AiTranslationRow> = {}): AiTranslationRow => ({
  id: 'translation-1' as any,
  hash: 'hash',
  refId: 'post-1' as any,
  refType: 'post',
  lang: 'en',
  sourceLang: 'zh',
  title: 'Title',
  text: 'Text',
  subtitle: null,
  summary: null,
  tags: [],
  sourceModifiedAt: null,
  aiModel: null,
  aiProvider: null,
  contentFormat: ContentFormat.Markdown,
  content: null,
  sourceBlockSnapshots: null,
  sourceMetaHashes: null,
  createdAt: now,
  ...overrides,
})

const articleDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'post-1',
  title: 'Source Title',
  text: 'Source Text',
  subtitle: null,
  summary: null,
  tags: [],
  contentFormat: ContentFormat.Lexical,
  content: '{"root":{"children":[]}}',
  isPublished: true,
  meta: { lang: 'zh' },
  modifiedAt: now,
  createdAt: now,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<AiTranslationRepository>()
  const databaseService = { findGlobalById: vi.fn(), findGlobalByIds: vi.fn() }
  const translationConsistencyService = {
    evaluateTranslationFreshness: vi.fn(() => 'valid'),
    filterTrulyStaleTranslations: vi.fn(),
    partitionValidAndStaleTranslations: vi.fn(),
  }
  const partialBuilder = { build: vi.fn() }
  const configService = {
    get: vi.fn(() => ({
      enableAutoGenerateTranslation: true,
      enableTranslation: true,
    })),
  }
  const aiService = {}
  const aiInFlightService = {}
  const eventManager = { emit: vi.fn() }
  const taskProcessor = { registerHandler: vi.fn() }
  const lexicalService = { lexicalToMarkdown: vi.fn(() => 'markdown') }
  const aiTaskService = { createTranslationTask: vi.fn() }
  const lexicalStrategy = {}
  const markdownStrategy = {}
  const service = new AiTranslationService(
    repository as any,
    databaseService as any,
    translationConsistencyService as any,
    partialBuilder as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    eventManager as any,
    taskProcessor as any,
    lexicalService as any,
    aiTaskService as any,
    lexicalStrategy as any,
    markdownStrategy as any,
  )
  return {
    aiTaskService,
    configService,
    databaseService,
    lexicalService,
    partialBuilder,
    repository,
    service,
    translationConsistencyService,
  }
}

describe('AiTranslationService', () => {
  it('loads translations with their source article from PG-backed services', async () => {
    const { databaseService, repository, service } = createService()
    databaseService.findGlobalById.mockResolvedValue({ id: 'post-1' })
    repository.listByRefId.mockResolvedValue([row()])

    await expect(service.getTranslationsByRefId('post-1')).resolves.toEqual({
      article: { id: 'post-1' },
      translations: [row()],
    })
  })

  it('updates lexical content by storing markdown text alongside content JSON', async () => {
    const { lexicalService, repository, service } = createService()
    repository.findById.mockResolvedValue(row())
    repository.updateById.mockResolvedValue(
      row({ content: '{"root":{}}', text: 'markdown' }),
    )

    await service.updateTranslation('translation-1', { content: '{"root":{}}' })

    expect(lexicalService.lexicalToMarkdown).toHaveBeenCalledWith('{"root":{}}')
    expect(repository.updateById).toHaveBeenCalledWith(
      'translation-1',
      expect.objectContaining({ content: '{"root":{}}', text: 'markdown' }),
    )
  })

  it('preserves supplied text when updating lexical content and text together', async () => {
    const { lexicalService, repository, service } = createService()
    repository.findById.mockResolvedValue(row())
    repository.updateById.mockResolvedValue(
      row({ content: '{"root":{}}', text: 'supplied text' }),
    )

    await service.updateTranslation('translation-1', {
      content: '{"root":{}}',
      text: 'supplied text',
    })

    expect(lexicalService.lexicalToMarkdown).not.toHaveBeenCalled()
    expect(repository.updateById).toHaveBeenCalledWith(
      'translation-1',
      expect.objectContaining({
        content: '{"root":{}}',
        text: 'supplied text',
      }),
    )
  })

  it('throws when deleting a missing translation row', async () => {
    const { repository, service } = createService()
    repository.deleteById.mockResolvedValue(0)

    await expect(service.deleteTranslation('missing')).rejects.toThrow(
      AppException,
    )
  })

  it('returns a valid article translation without scheduling or building partial output', async () => {
    const {
      databaseService,
      partialBuilder,
      repository,
      service,
      translationConsistencyService,
    } = createService()
    const validTranslation = row()
    const scheduleSpy = vi.spyOn(
      service,
      'scheduleRegenerationForStaleTranslations',
    )

    databaseService.findGlobalById.mockResolvedValue({
      document: articleDocument(),
      type: CollectionRefTypes.Post,
    })
    repository.findByRefAndLang.mockResolvedValue(validTranslation)
    translationConsistencyService.evaluateTranslationFreshness.mockReturnValue(
      'valid',
    )

    await expect(
      service.getTranslationForArticle('post-1', 'en'),
    ).resolves.toBe(validTranslation)

    expect(scheduleSpy).not.toHaveBeenCalled()
    expect(partialBuilder.build).not.toHaveBeenCalled()
  })

  it('returns null for a missing article translation without scheduling or building partial output', async () => {
    const {
      databaseService,
      partialBuilder,
      repository,
      service,
      translationConsistencyService,
    } = createService()
    const scheduleSpy = vi.spyOn(
      service,
      'scheduleRegenerationForStaleTranslations',
    )

    databaseService.findGlobalById.mockResolvedValue({
      document: articleDocument(),
      type: CollectionRefTypes.Post,
    })
    repository.findByRefAndLang.mockResolvedValue(null)

    await expect(
      service.getTranslationForArticle('post-1', 'en'),
    ).resolves.toBeNull()

    expect(
      translationConsistencyService.evaluateTranslationFreshness,
    ).not.toHaveBeenCalled()
    expect(scheduleSpy).not.toHaveBeenCalled()
    expect(partialBuilder.build).not.toHaveBeenCalled()
  })

  it('returns null for unknown article translation freshness without scheduling or building partial output', async () => {
    const {
      databaseService,
      partialBuilder,
      repository,
      service,
      translationConsistencyService,
    } = createService()
    const unknownTranslation = row({
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const scheduleSpy = vi.spyOn(
      service,
      'scheduleRegenerationForStaleTranslations',
    )

    databaseService.findGlobalById.mockResolvedValue({
      document: articleDocument(),
      type: CollectionRefTypes.Post,
    })
    repository.findByRefAndLang.mockResolvedValue(unknownTranslation)
    translationConsistencyService.evaluateTranslationFreshness.mockReturnValue(
      'unknown',
    )

    await expect(
      service.getTranslationForArticle('post-1', 'en'),
    ).resolves.toBeNull()

    expect(scheduleSpy).not.toHaveBeenCalled()
    expect(partialBuilder.build).not.toHaveBeenCalled()
  })

  it('returns a partial lexical translation for a stale article translation without persisting it', async () => {
    const {
      databaseService,
      partialBuilder,
      repository,
      service,
      translationConsistencyService,
    } = createService()
    const staleTranslation = row({
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const partialTranslation = row({
      id: 'translation-1' as any,
      title: 'Partial Title',
      text: 'Partial Text',
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const scheduleSpy = vi
      .spyOn(service, 'scheduleRegenerationForStaleTranslations')
      .mockResolvedValue(undefined)

    databaseService.findGlobalById.mockResolvedValue({
      document: articleDocument(),
      type: CollectionRefTypes.Post,
    })
    repository.findByRefAndLang.mockResolvedValue(staleTranslation)
    translationConsistencyService.evaluateTranslationFreshness.mockReturnValue(
      'stale',
    )
    partialBuilder.build.mockReturnValue({
      stats: {
        changedBlockCount: 0,
        reusedBlockCount: 1,
        skippedReusableBlockCount: 0,
        totalBlockCount: 1,
      },
      translation: partialTranslation,
    })

    await expect(
      service.getTranslationForArticle('post-1', 'en'),
    ).resolves.toBe(partialTranslation)

    expect(partialBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '{"root":{"children":[]}}',
        contentFormat: ContentFormat.Lexical,
        text: 'Source Text',
        title: 'Source Title',
      }),
      staleTranslation,
    )
    expect(scheduleSpy).toHaveBeenCalledWith(['post-1'], 'en')
    expect(repository.updateById).not.toHaveBeenCalled()
    expect(repository.upsert).not.toHaveBeenCalled()
  })

  it('returns null for a stale lexical article translation when partial build is unavailable', async () => {
    const {
      databaseService,
      partialBuilder,
      repository,
      service,
      translationConsistencyService,
    } = createService()
    const staleTranslation = row({
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const scheduleSpy = vi
      .spyOn(service, 'scheduleRegenerationForStaleTranslations')
      .mockResolvedValue(undefined)

    databaseService.findGlobalById.mockResolvedValue({
      document: articleDocument(),
      type: CollectionRefTypes.Post,
    })
    repository.findByRefAndLang.mockResolvedValue(staleTranslation)
    translationConsistencyService.evaluateTranslationFreshness.mockReturnValue(
      'stale',
    )
    partialBuilder.build.mockReturnValue(null)

    await expect(
      service.getTranslationForArticle('post-1', 'en'),
    ).resolves.toBeNull()

    expect(partialBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        contentFormat: ContentFormat.Lexical,
      }),
      staleTranslation,
    )
    expect(scheduleSpy).toHaveBeenCalledWith(['post-1'], 'en')
  })

  it('returns a partial requested stale translation without listing it as available', async () => {
    const {
      databaseService,
      partialBuilder,
      repository,
      service,
      translationConsistencyService,
    } = createService()
    const validTranslation = row({ lang: 'en' })
    const staleTranslation = row({
      id: 'translation-2' as any,
      lang: 'ja',
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const partialTranslation = row({
      id: 'translation-2' as any,
      lang: 'ja',
      text: 'Partial Japanese Text',
      contentFormat: ContentFormat.Lexical,
      content: '{"root":{"children":[]}}',
    })
    const scheduleSpy = vi
      .spyOn(service, 'scheduleRegenerationForStaleTranslations')
      .mockResolvedValue(undefined)

    databaseService.findGlobalById.mockResolvedValue({
      document: articleDocument(),
      type: CollectionRefTypes.Post,
    })
    repository.listByRefId.mockResolvedValue([
      validTranslation,
      staleTranslation,
    ])
    translationConsistencyService.evaluateTranslationFreshness.mockImplementation(
      (_snapshot: unknown, translation: AiTranslationRow) =>
        translation.lang === 'ja' ? 'stale' : 'valid',
    )
    partialBuilder.build.mockReturnValue({
      stats: {
        changedBlockCount: 0,
        reusedBlockCount: 1,
        skippedReusableBlockCount: 0,
        totalBlockCount: 1,
      },
      translation: partialTranslation,
    })

    await expect(
      service.getTranslationAndAvailableLanguages('post-1', 'ja'),
    ).resolves.toEqual({
      availableTranslations: ['en'],
      sourceLang: 'zh',
      translation: partialTranslation,
    })

    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
    expect(partialBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        contentFormat: ContentFormat.Lexical,
      }),
      staleTranslation,
    )
    expect(scheduleSpy).toHaveBeenCalledWith(['post-1'], 'ja')
  })
})
