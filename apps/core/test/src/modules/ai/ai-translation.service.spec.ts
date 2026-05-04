import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { BizException } from '~/common/exceptions/biz.exception'
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

const createService = () => {
  const repository = createPgRepositoryMock<AiTranslationRepository>()
  const databaseService = { findGlobalById: vi.fn(), findGlobalByIds: vi.fn() }
  const translationConsistencyService = {}
  const configService = {}
  const aiService = {}
  const aiInFlightService = {}
  const eventManager = { emit: vi.fn() }
  const taskProcessor = { registerHandler: vi.fn() }
  const lexicalService = { lexicalToMarkdown: vi.fn(() => 'markdown') }
  const aiTaskService = {}
  const lexicalStrategy = {}
  const markdownStrategy = {}
  const service = new AiTranslationService(
    repository as any,
    databaseService as any,
    translationConsistencyService as any,
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
  return { databaseService, lexicalService, repository, service }
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

  it('throws when deleting a missing translation row', async () => {
    const { repository, service } = createService()
    repository.deleteById.mockResolvedValue(0)

    await expect(service.deleteTranslation('missing')).rejects.toThrow(
      BizException,
    )
  })
})
