import { unlink } from 'node:fs/promises'

import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type {
  FileReferenceRepository,
  FileReferenceRow,
} from '~/modules/file/file-reference.repository'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import {
  FileReferenceStatus,
  FileUploadedBy,
} from '~/modules/file/file-reference.types'

vi.mock('node:fs/promises', () => ({ unlink: vi.fn() }))
vi.mock('~/constants/path.constant', () => ({ STATIC_FILE_DIR: '/static' }))

const createRef = (
  overrides: Partial<FileReferenceRow> = {},
): FileReferenceRow => ({
  id: 'file-1' as any,
  fileUrl: 'https://cdn.example.com/a.png',
  fileName: 'a.png',
  status: FileReferenceStatus.Pending,
  refId: null,
  refType: null,
  s3ObjectKey: null,
  readerId: null,
  uploadedBy: FileUploadedBy.Owner,
  mimeType: null,
  byteSize: null,
  detachedAt: null,
  createdAt: now,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<FileReferenceRepository>()
  const usageRepository = {
    findReferencedUrls: vi.fn().mockResolvedValue(new Set<string>()),
  }
  const fileUsageRepository = {
    replaceSourceUsages: vi.fn().mockResolvedValue(0),
  }
  const configsService = {
    get: vi.fn(async (key: string) => {
      if (key === 'url') {
        return { webUrl: 'https://innei.in', serverUrl: 'https://api.innei.in' }
      }
      return { customDomain: 'https://cdn.innei.in' }
    }),
  }
  const service = new FileReferenceService(
    repository as any,
    configsService as any,
    usageRepository as any,
    fileUsageRepository as any,
  )
  return {
    configsService,
    fileUsageRepository,
    repository,
    service,
    usageRepository,
  }
}

describe('FileReferenceService', () => {
  it('reuses existing PG file references for duplicate pending uploads', async () => {
    const { repository, service } = createService()
    const existing = createRef()
    repository.findFirstByUrl.mockResolvedValue(existing)

    await expect(
      service.createPendingReference(existing.fileUrl, existing.fileName),
    ).resolves.toBe(existing)
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('activates uploaded file URLs present in document content', async () => {
    const { fileUsageRepository, repository, service } = createService()

    await service.updateReferencesForDocument(
      { text: '[download](https://cdn.example.com/archive.zip)' },
      'post-1',
      'post',
    )

    expect(repository.markDocumentPending).toHaveBeenCalledWith(
      'post',
      'post-1',
    )
    expect(repository.activateUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/archive.zip',
      'post',
      'post-1',
    )
    expect(fileUsageRepository.replaceSourceUsages).toHaveBeenCalledWith({
      fileUrls: ['https://cdn.example.com/archive.zip'],
      sourceId: 'post-1',
      sourceType: 'post',
    })
  })

  it('removes document usage rows when a source is deleted', async () => {
    const { fileUsageRepository, repository, service } = createService()

    await service.removeReferencesForDocument('post-1', 'post')

    expect(repository.markDocumentPending).toHaveBeenCalledWith(
      'post',
      'post-1',
    )
    expect(fileUsageRepository.replaceSourceUsages).toHaveBeenCalledWith({
      fileUrls: [],
      sourceId: 'post-1',
      sourceType: 'post',
    })
  })

  it('returns the repository-paginated isolated file list', async () => {
    const { repository, service, usageRepository } = createService()
    const isolated = createRef({
      id: 'isolated' as any,
      fileUrl: 'https://cdn.example.com/unused.pdf',
      fileName: 'unused.pdf',
    })
    repository.listOrphans.mockResolvedValue({
      data: [isolated],
      pagination: {
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
        size: 20,
        total: 1,
        totalPage: 1,
      },
    })

    const result = await service.listOrphanFiles(1, 20)

    expect(result.data).toEqual([isolated])
    expect(result.pagination.total).toBe(1)
    expect(repository.listOrphans).toHaveBeenCalledWith(1, 20)
    expect(usageRepository.findReferencedUrls).not.toHaveBeenCalled()
  })

  it('refuses selected deletion when a persisted reference still exists', async () => {
    const { repository, service, usageRepository } = createService()
    const referenced = createRef({
      id: 'referenced' as any,
      fileUrl: 'https://cdn.example.com/cover.png',
      s3ObjectKey: 'cover.png',
    })
    repository.findById.mockResolvedValue(referenced)
    usageRepository.findReferencedUrls.mockResolvedValue(
      new Set([referenced.fileUrl]),
    )

    await expect(
      service.batchDeleteOrphans({ ids: [referenced.id] }),
    ).resolves.toEqual({ deletedCount: 0 })
    expect(repository.deleteById).not.toHaveBeenCalled()
  })

  it('deletes an isolated non-image file from its local object directory', async () => {
    const { repository, service } = createService()
    const isolated = createRef({
      id: 'isolated-file' as any,
      fileName: 'nested/archive.zip',
      fileUrl: 'https://api.example.com/objects/file/nested/archive.zip',
    })
    repository.findById.mockResolvedValue(isolated)
    vi.mocked(unlink).mockResolvedValue(undefined)

    await expect(
      service.batchDeleteOrphans({ ids: [isolated.id] }),
    ).resolves.toEqual({ deletedCount: 1 })
    expect(unlink).toHaveBeenCalledWith('/static/file/nested/archive.zip')
    expect(repository.deleteById).toHaveBeenCalledWith(isolated.id)
  })

  it('keeps reader uploads outside owner isolated-file deletion', async () => {
    const { repository, service, usageRepository } = createService()
    const readerUpload = createRef({
      id: 'reader-file' as any,
      fileUrl: 'https://api.example.com/objects/image/comment.png',
      uploadedBy: FileUploadedBy.Reader,
    })
    repository.findById.mockResolvedValue(readerUpload)

    await expect(
      service.batchDeleteOrphans({ ids: [readerUpload.id] }),
    ).resolves.toEqual({ deletedCount: 0 })
    expect(usageRepository.findReferencedUrls).not.toHaveBeenCalled()
    expect(repository.deleteById).not.toHaveBeenCalled()
  })

  it('filters comment images to configured first-party hosts', async () => {
    const { service } = createService()

    expect(
      service.parseCommentImageUrls(
        [
          '![a](https://cdn.innei.in/a.png)',
          '![b](https://third-party.example/b.png)',
          '![a](https://cdn.innei.in/a.png)',
        ].join('\n'),
        ['cdn.innei.in'],
      ),
    ).toEqual(['https://cdn.innei.in/a.png'])
  })

  it('classifies reader image changes into attach, revive, and detach sets', () => {
    const { service } = createService()
    const refs = [
      createRef({ id: 'pending' as any, fileUrl: 'https://cdn/a.png' }),
      createRef({
        id: 'detached' as any,
        fileUrl: 'https://cdn/b.png',
        status: FileReferenceStatus.Detached,
        refId: 'comment-1' as any,
        refType: 'comment',
      }),
      createRef({
        id: 'active' as any,
        fileUrl: 'https://cdn/c.png',
        status: FileReferenceStatus.Active,
        refId: 'comment-1' as any,
        refType: 'comment',
      }),
    ]

    const diff = service.diffReaderImages(
      refs,
      ['https://cdn/a.png', 'https://cdn/b.png'],
      'comment-1',
    )

    expect(diff.toAttach.map((ref) => ref.id)).toEqual(['pending'])
    expect(diff.toRevive.map((ref) => ref.id)).toEqual(['detached'])
    expect(diff.toDetach.map((ref) => ref.id)).toEqual(['active'])
    expect(diff.totalReferenced).toBe(2)
  })
})
