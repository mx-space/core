import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { BizException } from '~/common/exceptions/biz.exception'
import { DraftRefType } from '~/modules/draft/draft.enum'
import type {
  DraftRepository,
  DraftRow,
} from '~/modules/draft/draft.repository'
import { DraftService } from '~/modules/draft/draft.service'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { ContentFormat } from '~/shared/types/content-format.type'

const createDraft = (overrides: Partial<DraftRow> = {}): DraftRow => ({
  id: 'draft-1' as any,
  title: 'Draft',
  text: 'old text',
  content: null,
  contentFormat: ContentFormat.Markdown,
  refType: DraftRefType.Post,
  refId: null,
  publishedId: null,
  publishedVersion: null,
  typeSpecificData: null,
  meta: null,
  version: 1,
  history: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<DraftRepository>()
  const fileReferenceService = {
    updateReferencesForDocument: vi.fn(),
    removeReferencesForDocument: vi.fn(),
  }
  const draftHistoryService = {
    hasContentChange: vi.fn(() => false),
    pushHistoryEntry: vi.fn(),
    getHistorySummary: vi.fn(() => []),
    resolveHistoryEntry: vi.fn(),
  }
  const service = new DraftService(
    repository as any,
    fileReferenceService as any,
    draftHistoryService as any,
  )

  return { draftHistoryService, fileReferenceService, repository, service }
}

describe('DraftService', () => {
  it('updates an existing referenced draft instead of creating a duplicate', async () => {
    const { repository, service } = createService()
    const existing = createDraft({ refId: 'post-1' as any })
    const updated = createDraft({ refId: 'post-1' as any, text: 'new text' })
    repository.findByRef.mockResolvedValue(existing)
    repository.findById.mockResolvedValue(existing)
    repository.update.mockResolvedValue(updated)

    const result = await service.create({
      title: 'Draft',
      text: 'new text',
      refType: DraftRefType.Post,
      refId: 'post-1',
    } as any)

    expect(result).toBe(updated)
    expect(repository.create).not.toHaveBeenCalled()
    expect(repository.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ text: 'new text' }),
    )
  })

  it('creates markdown drafts and synchronizes file references when text exists', async () => {
    const { fileReferenceService, repository, service } = createService()
    const created = createDraft({ text: '![x](https://example.com/a.png)' })
    repository.create.mockResolvedValue(created)

    await expect(
      service.create({ title: 'Draft', text: created.text } as any),
    ).resolves.toBe(created)

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ contentFormat: ContentFormat.Markdown }),
    )
    expect(
      fileReferenceService.updateReferencesForDocument,
    ).toHaveBeenCalledWith(created, created.id, FileReferenceType.Draft)
  })

  it('increments version and stores history only for content changes', async () => {
    const { draftHistoryService, repository, service } = createService()
    const draft = createDraft({ history: [] })
    repository.findById.mockResolvedValue(draft)
    repository.update.mockResolvedValue(createDraft({ version: 2 }))
    draftHistoryService.hasContentChange.mockReturnValue(true)
    draftHistoryService.pushHistoryEntry.mockReturnValue({
      history: [{ version: 1, savedAt: now }],
    })

    await service.update(draft.id, { text: 'new text' } as any)

    expect(repository.update).toHaveBeenCalledWith(
      draft.id,
      expect.objectContaining({
        version: 2,
        history: [{ version: 1, savedAt: now }],
      }),
    )
  })

  it('removes PG draft rows and file references together', async () => {
    const { fileReferenceService, repository, service } = createService()
    repository.deleteById.mockResolvedValue(createDraft())

    await service.delete('draft-1')

    expect(
      fileReferenceService.removeReferencesForDocument,
    ).toHaveBeenCalledWith('draft-1', FileReferenceType.Draft)
  })

  it('throws when updating a missing draft', async () => {
    const { repository, service } = createService()
    repository.findById.mockResolvedValue(null)

    await expect(
      service.update('missing', { text: 'x' } as any),
    ).rejects.toThrow(BizException)
  })
})
