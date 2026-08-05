import { Injectable, Logger } from '@nestjs/common'

import { FileReferenceRepository } from './file-reference.repository'
import { FileReferenceStatus } from './file-reference.types'
import { FileReferenceInventoryService } from './file-reference-inventory.service'
import { FileReferenceUsageRepository } from './file-reference-usage.repository'
import { FileUsageRepository } from './file-usage.repository'
import type {
  FileReferenceReconciliationResult,
  FileUsageInput,
  LocalFileCandidate,
} from './file-usage.types'

const LOOKUP_BATCH_SIZE = 500

@Injectable()
export class FileReferenceReconciliationService {
  private readonly logger = new Logger(FileReferenceReconciliationService.name)

  constructor(
    private readonly fileReferenceRepository: FileReferenceRepository,
    private readonly usageResolver: FileReferenceUsageRepository,
    private readonly fileUsageRepository: FileUsageRepository,
    private readonly inventory: FileReferenceInventoryService,
  ) {}

  async reconcile(
    options: { apply?: boolean } = {},
  ): Promise<FileReferenceReconciliationResult> {
    const apply = options.apply === true
    const [ownerReferences, localFiles] = await Promise.all([
      this.fileReferenceRepository.findOwnerReferences(),
      this.inventory.listLocalFiles(),
    ])
    const existingLocalReferences = await this.findReferencesByUrls(
      localFiles.map((file) => file.fileUrl),
    )
    const existingLocalUrls = new Set(
      existingLocalReferences.map((file) => file.fileUrl),
    )
    const missingLocalFiles = localFiles.filter(
      (file) => !existingLocalUrls.has(file.fileUrl),
    )

    const candidateUrls = [
      ...new Set([
        ...ownerReferences.map((file) => file.fileUrl),
        ...missingLocalFiles.map((file) => file.fileUrl),
      ]),
    ]
    const usageMatches =
      await this.usageResolver.findUsageMatches(candidateUrls)
    const referencedUrls = new Set(usageMatches.map((usage) => usage.fileUrl))

    if (!apply) {
      const currentUsages =
        await this.fileUsageRepository.findForFileReferences(
          ownerReferences.map((file) => file.id),
        )
      return this.buildResult({
        applied: false,
        localFiles,
        missingLocalFiles,
        ownerReferences,
        referencedUrls,
        usageChanges: this.countPreviewUsageChanges({
          currentUsages,
          missingLocalFiles,
          ownerReferences,
          usageMatches,
        }),
        usageCount: usageMatches.length,
      })
    }

    const latestMissingReferences = await this.findReferencesByUrls(
      missingLocalFiles.map((file) => file.fileUrl),
    )
    const latestExistingUrls = new Set(
      latestMissingReferences.map((file) => file.fileUrl),
    )
    const filesToCreate = missingLocalFiles.filter(
      (file) => !latestExistingUrls.has(file.fileUrl),
    )
    if (filesToCreate.length > 0) {
      await this.fileReferenceRepository.createOwnerPendingMany(filesToCreate)
    }

    const reconciledReferences =
      await this.fileReferenceRepository.findOwnerReferences()
    const referencesByUrl = new Map<string, typeof reconciledReferences>()
    for (const reference of reconciledReferences) {
      const references = referencesByUrl.get(reference.fileUrl) ?? []
      references.push(reference)
      referencesByUrl.set(reference.fileUrl, references)
    }

    const usages: FileUsageInput[] = []
    for (const match of usageMatches) {
      for (const reference of referencesByUrl.get(match.fileUrl) ?? []) {
        usages.push({
          fileReferenceId: reference.id,
          sourceType: match.sourceType,
          sourceId: match.sourceId,
          sourceField: match.sourceField,
        })
      }
    }

    const activeIds = reconciledReferences
      .filter((file) => referencedUrls.has(file.fileUrl))
      .map((file) => file.id)
    const pendingIds = reconciledReferences
      .filter((file) => !referencedUrls.has(file.fileUrl))
      .map((file) => file.id)
    const currentUsages = await this.fileUsageRepository.findForFileReferences(
      reconciledReferences.map((file) => file.id),
    )
    const usageChanges = this.countUsageChanges(currentUsages, usages)
    await this.fileUsageRepository.reconcileFileReferences({
      activeIds,
      fileReferenceIds: reconciledReferences.map((file) => file.id),
      pendingIds,
      usages,
    })

    const result = this.buildResult({
      applied: true,
      localFiles,
      missingLocalFiles,
      ownerReferences,
      referencedUrls,
      usageChanges,
      usageCount: usages.length,
    })
    this.logger.log(
      `reconciled file references scanned=${result.scannedFiles} usages=${result.usages} missing=${result.missingReferences} referenced=${result.referencedFiles} isolated=${result.isolatedFiles}`,
    )
    return result
  }

  private buildResult(input: {
    applied: boolean
    localFiles: LocalFileCandidate[]
    missingLocalFiles: LocalFileCandidate[]
    ownerReferences: Awaited<
      ReturnType<FileReferenceRepository['findOwnerReferences']>
    >
    referencedUrls: Set<string>
    usageChanges: number
    usageCount: number
  }): FileReferenceReconciliationResult {
    const candidateUrls = new Set([
      ...input.ownerReferences.map((file) => file.fileUrl),
      ...input.missingLocalFiles.map((file) => file.fileUrl),
    ])
    const statusToActive =
      input.ownerReferences.filter(
        (file) =>
          input.referencedUrls.has(file.fileUrl) &&
          file.status !== FileReferenceStatus.Active,
      ).length +
      input.missingLocalFiles.filter((file) =>
        input.referencedUrls.has(file.fileUrl),
      ).length
    const statusToPending = input.ownerReferences.filter(
      (file) =>
        !input.referencedUrls.has(file.fileUrl) &&
        file.status !== FileReferenceStatus.Pending,
    ).length

    return {
      applied: input.applied,
      discoveredLocalFiles: input.localFiles.length,
      isolatedFiles: [...candidateUrls].filter(
        (url) => !input.referencedUrls.has(url),
      ).length,
      missingReferences: input.missingLocalFiles.length,
      referencedFiles: [...candidateUrls].filter((url) =>
        input.referencedUrls.has(url),
      ).length,
      scannedFiles: candidateUrls.size,
      statusToActive,
      statusToPending,
      usageChanges: input.usageChanges,
      usages: input.usageCount,
    }
  }

  private countPreviewUsageChanges(input: {
    currentUsages: FileUsageInput[]
    missingLocalFiles: LocalFileCandidate[]
    ownerReferences: Awaited<
      ReturnType<FileReferenceRepository['findOwnerReferences']>
    >
    usageMatches: Awaited<
      ReturnType<FileReferenceUsageRepository['findUsageMatches']>
    >
  }): number {
    const referencesByUrl = new Map<string, string[]>()
    for (const reference of input.ownerReferences) {
      const ids = referencesByUrl.get(reference.fileUrl) ?? []
      ids.push(reference.id)
      referencesByUrl.set(reference.fileUrl, ids)
    }
    const missingUrls = new Set(
      input.missingLocalFiles.map((file) => file.fileUrl),
    )
    const desiredExisting: FileUsageInput[] = []
    let missingUsageCount = 0
    for (const match of input.usageMatches) {
      for (const fileReferenceId of referencesByUrl.get(match.fileUrl) ?? []) {
        desiredExisting.push({
          fileReferenceId,
          sourceField: match.sourceField,
          sourceId: match.sourceId,
          sourceType: match.sourceType,
        })
      }
      if (missingUrls.has(match.fileUrl)) missingUsageCount++
    }
    return (
      this.countUsageChanges(input.currentUsages, desiredExisting) +
      missingUsageCount
    )
  }

  private countUsageChanges(
    currentUsages: FileUsageInput[],
    desiredUsages: FileUsageInput[],
  ): number {
    const toKey = (usage: FileUsageInput) =>
      [
        usage.fileReferenceId,
        usage.sourceType,
        usage.sourceId,
        usage.sourceField,
      ].join('\0')
    const current = new Set(currentUsages.map(toKey))
    const desired = new Set(desiredUsages.map(toKey))
    let changes = 0
    for (const key of current) if (!desired.has(key)) changes++
    for (const key of desired) if (!current.has(key)) changes++
    return changes
  }

  private async findReferencesByUrls(fileUrls: string[]) {
    const references: Awaited<
      ReturnType<FileReferenceRepository['findByUrls']>
    > = []
    for (let index = 0; index < fileUrls.length; index += LOOKUP_BATCH_SIZE) {
      references.push(
        ...(await this.fileReferenceRepository.findByUrls(
          fileUrls.slice(index, index + LOOKUP_BATCH_SIZE),
        )),
      )
    }
    return references
  }
}
