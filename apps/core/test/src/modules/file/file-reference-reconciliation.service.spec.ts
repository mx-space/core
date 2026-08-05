import { describe, expect, it } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type { FileReferenceRepository } from '~/modules/file/file-reference.repository'
import {
  type FileReferenceRow,
  FileReferenceStatus,
  FileUploadedBy,
} from '~/modules/file/file-reference.types'
import type { FileReferenceInventoryService } from '~/modules/file/file-reference-inventory.service'
import { FileReferenceReconciliationService } from '~/modules/file/file-reference-reconciliation.service'
import type { FileReferenceUsageRepository } from '~/modules/file/file-reference-usage.repository'
import type { FileUsageRepository } from '~/modules/file/file-usage.repository'

const createRef = (
  id: string,
  fileUrl: string,
  status: FileReferenceStatus,
): FileReferenceRow => ({
  id,
  byteSize: null,
  createdAt: now,
  detachedAt: null,
  fileName: fileUrl.split('/').at(-1)!,
  fileUrl,
  mimeType: null,
  readerId: null,
  refId: null,
  refType: null,
  s3ObjectKey: null,
  status,
  uploadedBy: FileUploadedBy.Owner,
})

const createService = () => {
  const repository = createPgRepositoryMock<FileReferenceRepository>()
  const usageResolver = createPgRepositoryMock<FileReferenceUsageRepository>()
  const fileUsageRepository = createPgRepositoryMock<FileUsageRepository>()
  const inventory = createPgRepositoryMock<FileReferenceInventoryService>()
  const service = new FileReferenceReconciliationService(
    repository as never,
    usageResolver as never,
    fileUsageRepository as never,
    inventory as never,
  )
  fileUsageRepository.findForFileReferences.mockResolvedValue([])
  return {
    fileUsageRepository,
    inventory,
    repository,
    service,
    usageResolver,
  }
}

describe('FileReferenceReconciliationService', () => {
  it('returns a dry-run preview without changing references or statuses', async () => {
    const {
      fileUsageRepository,
      inventory,
      repository,
      service,
      usageResolver,
    } = createService()
    const referenced = createRef(
      'ref-a',
      'https://cdn.example.com/shared.png',
      FileReferenceStatus.Pending,
    )
    const isolated = createRef(
      'ref-b',
      'https://cdn.example.com/unused.pdf',
      FileReferenceStatus.Active,
    )
    repository.findOwnerReferences.mockResolvedValue([referenced, isolated])
    inventory.listLocalFiles.mockResolvedValue([])
    usageResolver.findUsageMatches.mockResolvedValue([
      {
        fileUrl: referenced.fileUrl,
        sourceField: 'meta',
        sourceId: 'post-1',
        sourceType: 'post',
      },
      {
        fileUrl: referenced.fileUrl,
        sourceField: 'raw',
        sourceId: 'skill-1',
        sourceType: 'skill',
      },
    ])

    await expect(service.reconcile()).resolves.toEqual({
      applied: false,
      discoveredLocalFiles: 0,
      isolatedFiles: 1,
      missingReferences: 0,
      referencedFiles: 1,
      scannedFiles: 2,
      statusToActive: 1,
      statusToPending: 1,
      usageChanges: 2,
      usages: 2,
    })
    expect(repository.createOwnerPendingMany).not.toHaveBeenCalled()
    expect(fileUsageRepository.reconcileFileReferences).not.toHaveBeenCalled()
  })

  it('backfills local files and applies multi-source usages without deleting files', async () => {
    const {
      fileUsageRepository,
      inventory,
      repository,
      service,
      usageResolver,
    } = createService()
    const referenced = createRef(
      'ref-a',
      'https://cdn.example.com/shared.png',
      FileReferenceStatus.Pending,
    )
    const isolated = createRef(
      'ref-b',
      'https://cdn.example.com/unused.pdf',
      FileReferenceStatus.Active,
    )
    const localFile = {
      fileName: 'legacy.zip',
      fileUrl: 'https://api.example.com/objects/file/legacy.zip',
    }
    const created = createRef(
      'ref-c',
      localFile.fileUrl,
      FileReferenceStatus.Pending,
    )
    repository.findOwnerReferences
      .mockResolvedValueOnce([referenced, isolated])
      .mockResolvedValueOnce([referenced, isolated, created])
    repository.findByUrls.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    repository.createOwnerPendingMany.mockResolvedValue([created])
    inventory.listLocalFiles.mockResolvedValue([localFile])
    usageResolver.findUsageMatches.mockResolvedValue([
      {
        fileUrl: referenced.fileUrl,
        sourceField: 'meta',
        sourceId: 'post-1',
        sourceType: 'post',
      },
      {
        fileUrl: referenced.fileUrl,
        sourceField: 'raw',
        sourceId: 'skill-1',
        sourceType: 'skill',
      },
      {
        fileUrl: localFile.fileUrl,
        sourceField: 'icon',
        sourceId: 'topic-1',
        sourceType: 'topic',
      },
    ])

    await expect(service.reconcile({ apply: true })).resolves.toEqual({
      applied: true,
      discoveredLocalFiles: 1,
      isolatedFiles: 1,
      missingReferences: 1,
      referencedFiles: 2,
      scannedFiles: 3,
      statusToActive: 2,
      statusToPending: 1,
      usageChanges: 3,
      usages: 3,
    })
    expect(repository.createOwnerPendingMany).toHaveBeenCalledWith([localFile])
    expect(fileUsageRepository.reconcileFileReferences).toHaveBeenCalledWith({
      activeIds: ['ref-a', 'ref-c'],
      fileReferenceIds: ['ref-a', 'ref-b', 'ref-c'],
      pendingIds: ['ref-b'],
      usages: expect.arrayContaining([
        {
          fileReferenceId: 'ref-a',
          sourceField: 'meta',
          sourceId: 'post-1',
          sourceType: 'post',
        },
        {
          fileReferenceId: 'ref-a',
          sourceField: 'raw',
          sourceId: 'skill-1',
          sourceType: 'skill',
        },
        {
          fileReferenceId: 'ref-c',
          sourceField: 'icon',
          sourceId: 'topic-1',
          sourceType: 'topic',
        },
      ]),
    })
    expect(repository.deleteById).not.toHaveBeenCalled()
  })

  it('looks up inventories larger than one batch without losing candidates', async () => {
    const { inventory, repository, service, usageResolver } = createService()
    const localFiles = Array.from({ length: 501 }, (_, index) => ({
      fileName: `fixture-${index}.json`,
      fileUrl: `https://api.example.com/objects/file/fixture-${index}.json`,
    }))
    repository.findOwnerReferences.mockResolvedValue([])
    repository.findByUrls.mockResolvedValue([])
    inventory.listLocalFiles.mockResolvedValue(localFiles)
    usageResolver.findUsageMatches.mockResolvedValue([])

    await expect(service.reconcile()).resolves.toEqual({
      applied: false,
      discoveredLocalFiles: 501,
      isolatedFiles: 501,
      missingReferences: 501,
      referencedFiles: 0,
      scannedFiles: 501,
      statusToActive: 0,
      statusToPending: 0,
      usageChanges: 0,
      usages: 0,
    })
    expect(repository.findByUrls).toHaveBeenCalledTimes(2)
    expect(repository.findByUrls.mock.calls[0]?.[0]).toHaveLength(500)
    expect(repository.findByUrls.mock.calls[1]?.[0]).toHaveLength(1)
  })
})
