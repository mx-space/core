import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppErrorCode } from '~/common/errors/app-error-code'
import { AppException } from '~/common/errors/exception.types'
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
  it('rejects a create that races with an existing referenced draft', async () => {
    const { repository, service } = createService()
    const existing = createDraft({ refId: 'post-1' as any })
    repository.findByRef.mockResolvedValue(existing)

    const error = await service
      .create({
        title: 'Draft',
        text: 'new text',
        refType: DraftRefType.Post,
        refId: 'post-1',
      } as any)
      .catch((reason) => reason)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe(AppErrorCode.DRAFT_VERSION_CONFLICT)
    expect(error.details).toEqual({
      actualVersion: 1,
      expectedVersion: 0,
      id: existing.id,
    })
    expect(repository.create).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('converts a concurrent referenced-draft insert loser into a version conflict', async () => {
    const { repository, service } = createService()
    const winner = createDraft({ refId: 'post-1' as any })
    repository.findByRef
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner)
    repository.create.mockRejectedValue({ code: '23505' })

    const error = await service
      .create({
        title: 'Draft',
        text: 'loser',
        refType: DraftRefType.Post,
        refId: 'post-1',
      } as any)
      .catch((reason) => reason)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe(AppErrorCode.DRAFT_VERSION_CONFLICT)
    expect(error.details).toEqual({
      actualVersion: 1,
      expectedVersion: 0,
      id: winner.id,
    })
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

  it('increments the draft revision and stores history for content changes', async () => {
    const { draftHistoryService, repository, service } = createService()
    const draft = createDraft({ history: [] })
    repository.findById.mockResolvedValue(draft)
    repository.update.mockResolvedValue(createDraft({ version: 2 }))
    draftHistoryService.hasContentChange.mockReturnValue(true)
    draftHistoryService.pushHistoryEntry.mockReturnValue({
      history: [{ version: 1, savedAt: now }],
    })

    await service.update(draft.id, {
      expectedVersion: 1,
      text: 'new text',
    } as any)

    expect(repository.update).toHaveBeenCalledWith(
      draft.id,
      expect.objectContaining({
        version: 2,
        history: [{ version: 1, savedAt: now }],
      }),
      1,
    )
  })

  it('increments the draft revision for metadata-only updates', async () => {
    const { draftHistoryService, repository, service } = createService()
    const draft = createDraft()
    repository.findById.mockResolvedValue(draft)
    repository.update.mockResolvedValue(createDraft({ version: 2 }))

    await service.update(draft.id, {
      expectedVersion: 1,
      meta: { description: 'updated' },
    } as any)

    expect(draftHistoryService.pushHistoryEntry).not.toHaveBeenCalled()
    expect(repository.update).toHaveBeenCalledWith(
      draft.id,
      expect.objectContaining({
        meta: { description: 'updated' },
        version: 2,
      }),
      1,
    )
  })

  it('rejects a stale version before writing', async () => {
    const { repository, service } = createService()
    repository.findById.mockResolvedValue(createDraft({ version: 3 }))

    const error = await service
      .update('draft-1', { expectedVersion: 2, text: 'stale' } as any)
      .catch((reason) => reason)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe(AppErrorCode.DRAFT_VERSION_CONFLICT)
    expect(error.details).toEqual({
      actualVersion: 3,
      expectedVersion: 2,
      id: 'draft-1',
    })
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('rejects the loser when another writer wins the compare-and-swap', async () => {
    const { repository, service } = createService()
    repository.findById
      .mockResolvedValueOnce(createDraft({ version: 1 }))
      .mockResolvedValueOnce(createDraft({ version: 2, text: 'winner' }))
    repository.update.mockResolvedValue(null)

    const error = await service
      .update('draft-1', { expectedVersion: 1, text: 'loser' } as any)
      .catch((reason) => reason)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe(AppErrorCode.DRAFT_VERSION_CONFLICT)
    expect(error.details).toEqual({
      actualVersion: 2,
      expectedVersion: 1,
      id: 'draft-1',
    })
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
    ).rejects.toThrow(AppException)
  })
})
