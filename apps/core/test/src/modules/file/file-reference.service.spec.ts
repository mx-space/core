import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type {
  FileReferenceRepository,
  FileReferenceRow,
} from '~/modules/file/file-reference.repository'
import {
  FileReferenceStatus,
  FileUploadedBy,
} from '~/modules/file/file-reference.repository'
import { FileReferenceService } from '~/modules/file/file-reference.service'

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
  )
  return { configsService, repository, service }
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

  it('activates only image URLs present in document content', async () => {
    const { repository, service } = createService()

    await service.updateReferencesForDocument(
      { text: '![x](https://cdn.example.com/a.png)' },
      'post-1',
      'post',
    )

    expect(repository.markDocumentPending).toHaveBeenCalledWith(
      'post',
      'post-1',
    )
    expect(repository.activateUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/a.png',
      'post',
      'post-1',
    )
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
