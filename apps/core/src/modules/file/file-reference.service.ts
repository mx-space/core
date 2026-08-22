import { unlink } from 'node:fs/promises'
import path from 'node:path'

import { Inject, Injectable, Logger, Optional } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { ContentFormat } from '~/shared/types/content-format.type'
import { extractFileUrlsFromContent } from '~/utils/content.util'
import { pickImagesFromMarkdown } from '~/utils/pic.util'
import { S3Uploader } from '~/utils/s3.util'

import type { FileType } from './file.type'
import { FileReferenceRepository } from './file-reference.repository'
import {
  FileDeletionReason,
  type FileReferenceRow,
  FileReferenceStatus,
  FileReferenceType,
  FileUploadedBy,
} from './file-reference.types'
import { FileReferenceUsageRepository } from './file-reference-usage.repository'
import {
  FILE_STORAGE_ROOT,
  resolveFileStorageRoot,
} from './file-storage.constants'
import { FileUsageRepository } from './file-usage.repository'

interface ContentLike {
  text: string | null
  contentFormat?: ContentFormat | string | null
  content?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | string | null
}

export interface ReaderImageDiff {
  toAttach: FileReferenceRow[]
  toDetach: FileReferenceRow[]
  toRevive: FileReferenceRow[]
  totalReferenced: number
}

@Injectable()
export class FileReferenceService {
  private readonly logger = new Logger(FileReferenceService.name)
  private readonly storageRoot: string

  private isEnoent(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    )
  }

  private resolveLocalFileType(fileUrl: string): FileType | null {
    try {
      const pathname = new URL(fileUrl).pathname
      const match = pathname.match(
        /\/objects\/(icon|file|avatar|image|video)\//u,
      )
      return (match?.[1] as FileType | undefined) ?? null
    } catch {
      return null
    }
  }

  /**
   * Delete a local uploaded file. If it already does not exist on disk
   * (ENOENT), treat the cleanup as successful.
   */
  private async unlinkLocalFile(file: FileReferenceRow): Promise<boolean> {
    const type = this.resolveLocalFileType(file.fileUrl)
    if (!type) return false

    const basePath = path.resolve(this.storageRoot, type)
    const localPath = path.resolve(basePath, file.fileName)
    if (!localPath.startsWith(`${basePath}${path.sep}`)) return false

    try {
      await unlink(localPath)
    } catch (err) {
      if (this.isEnoent(err)) {
        return true
      }
      throw err
    }
    return true
  }

  constructor(
    private readonly fileReferenceRepository: FileReferenceRepository,
    private readonly configsService: ConfigsService,
    private readonly fileReferenceUsageRepository: FileReferenceUsageRepository,
    private readonly fileUsageRepository: FileUsageRepository,
    @Optional() @Inject(FILE_STORAGE_ROOT) storageRoot?: string,
  ) {
    this.storageRoot = storageRoot ?? resolveFileStorageRoot()
  }

  async createPendingReference(
    fileUrl: string,
    fileName: string,
    s3ObjectKey?: string,
  ) {
    const existing = await this.fileReferenceRepository.findFirstByUrl(fileUrl)
    if (existing) {
      return existing
    }

    return this.fileReferenceRepository.create({
      fileUrl,
      fileName,
      status: FileReferenceStatus.Pending,
      s3ObjectKey,
    })
  }

  async createReaderPendingReference(input: {
    fileUrl: string
    fileName: string
    readerId: string
    mimeType: string
    byteSize: number
    s3ObjectKey?: string | null
  }) {
    return this.fileReferenceRepository.create({
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      status: FileReferenceStatus.Pending,
      readerId: input.readerId,
      uploadedBy: FileUploadedBy.Reader,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      s3ObjectKey: input.s3ObjectKey ?? null,
    })
  }

  async activateReferences(
    doc: ContentLike,
    refId: string,
    refType: FileReferenceType,
  ) {
    const fileUrls = extractFileUrlsFromContent(doc)
    if (fileUrls.length > 0) {
      await this.fileReferenceRepository.activateByUrls(
        fileUrls,
        refType,
        refId,
      )
    }
    await this.fileUsageRepository.replaceSourceUsages({
      fileUrls,
      sourceId: refId,
      sourceType: refType,
    })
  }

  async updateReferencesForDocument(
    doc: ContentLike,
    refId: string,
    refType: FileReferenceType,
  ) {
    const fileUrls = extractFileUrlsFromContent(doc)

    await this.fileReferenceRepository.markDocumentPending(refType, refId)

    if (fileUrls.length > 0) {
      for (const fileUrl of fileUrls) {
        await this.fileReferenceRepository.activateUrl(fileUrl, refType, refId)
      }
    }
    await this.fileUsageRepository.replaceSourceUsages({
      fileUrls,
      sourceId: refId,
      sourceType: refType,
    })
  }

  async removeReferencesForDocument(refId: string, refType: FileReferenceType) {
    await this.fileReferenceRepository.markDocumentPending(refType, refId)
    await this.fileUsageRepository.replaceSourceUsages({
      fileUrls: [],
      sourceId: refId,
      sourceType: refType,
    })
  }

  /**
   * Extract image URLs from comment markdown, keeping only URLs whose host
   * belongs to this site.
   */
  parseCommentImageUrls(text: string, allowedHosts: string[]): string[] {
    if (!text) return []
    const urls = pickImagesFromMarkdown(text)
    if (urls.length === 0) return []

    const hostSet = new Set(
      allowedHosts.filter(Boolean).map((h) => h.toLowerCase()),
    )

    const result: string[] = []
    const seen = new Set<string>()
    for (const url of urls) {
      try {
        const parsed = new URL(url)
        if (!hostSet.has(parsed.host.toLowerCase())) continue
      } catch {
        continue
      }
      if (seen.has(url)) continue
      seen.add(url)
      result.push(url)
    }
    return result
  }

  /**
   * Collect the image hosts allowed for this site: webUrl, serverUrl, and customDomain.
   */
  async collectAllowedImageHosts(): Promise<string[]> {
    const [{ webUrl, serverUrl }, imageStorageConfig] = await Promise.all([
      this.configsService.get('url'),
      this.configsService.get('imageStorageOptions'),
    ])
    const hosts: string[] = []
    for (const candidate of [
      webUrl,
      serverUrl,
      imageStorageConfig?.customDomain,
    ]) {
      if (!candidate) continue
      try {
        hosts.push(new URL(candidate).host)
      } catch {
        // ignore invalid URL
      }
    }
    return hosts
  }

  /**
   * Compute the attach / detach / revive file sets for a comment update.
   */
  diffReaderImages(
    refs: FileReferenceRow[],
    newUrls: string[],
    commentId: string,
  ): ReaderImageDiff {
    const newUrlSet = new Set(newUrls)
    const toAttach: FileReferenceRow[] = []
    const toRevive: FileReferenceRow[] = []
    const toDetach: FileReferenceRow[] = []

    for (const ref of refs) {
      if (newUrlSet.has(ref.fileUrl)) {
        if (ref.status === FileReferenceStatus.Pending) {
          toAttach.push(ref)
        } else if (
          ref.status === FileReferenceStatus.Detached &&
          ref.refId === commentId
        ) {
          toRevive.push(ref)
        }
      } else if (
        ref.status === FileReferenceStatus.Active &&
        ref.refId === commentId &&
        ref.refType === FileReferenceType.Comment
      ) {
        toDetach.push(ref)
      }
    }

    return {
      toAttach,
      toRevive,
      toDetach,
      totalReferenced: newUrlSet.size,
    }
  }

  async findReferencesByUrls(urls: string[]) {
    return this.fileReferenceRepository.findByUrls(urls)
  }

  async findActiveByCommentId(commentId: string) {
    return this.fileReferenceRepository.findActiveOrDetachedByCommentId(
      commentId,
    )
  }

  /**
   * Attach images on comment create / update.
   */
  async attachReaderImagesToComment(params: {
    commentId: string
    readerId: string
    text: string
    mode: 'create' | 'update'
  }): Promise<{ attachedCount: number; detachedCount: number }> {
    const { commentId, readerId, text, mode } = params

    const config = await this.configsService.get('commentUploadOptions')
    const cap = config.commentImageMaxCount ?? 4

    const hosts = await this.collectAllowedImageHosts()
    const newUrls = this.parseCommentImageUrls(text, hosts)

    if (newUrls.length > cap) {
      throw createAppException(AppErrorCode.COMMENT_IMAGE_CAP_EXCEEDED)
    }

    if (newUrls.length === 0 && mode === 'create') {
      return { attachedCount: 0, detachedCount: 0 }
    }

    const candidates = await this.findReferencesByUrls(newUrls)

    for (const ref of candidates) {
      if (ref.uploadedBy !== FileUploadedBy.Reader) continue
      if (ref.readerId && ref.readerId !== readerId) {
        throw createAppException(AppErrorCode.COMMENT_UPLOAD_FILE_NOT_OWNED)
      }
    }

    for (const ref of candidates) {
      if (ref.status !== FileReferenceStatus.Active) continue
      if (
        ref.refType === FileReferenceType.Comment &&
        ref.refId === commentId
      ) {
        continue
      }
      throw createAppException(AppErrorCode.COMMENT_UPLOAD_FILE_ALREADY_BOUND)
    }

    const existingForComment =
      mode === 'update' ? await this.findActiveByCommentId(commentId) : []
    const allRefs = [
      ...candidates,
      ...existingForComment.filter(
        (ref) => !candidates.some((c) => c.id === ref.id),
      ),
    ]

    const diff = this.diffReaderImages(allRefs, newUrls, commentId)

    const toActivate = [...diff.toAttach, ...diff.toRevive]
    await Promise.all([
      ...toActivate.map((ref) =>
        this.fileReferenceRepository.markActive(
          ref.id,
          commentId,
          FileReferenceType.Comment,
        ),
      ),
      ...diff.toDetach.map((ref) =>
        this.fileReferenceRepository.markDetached(ref.id),
      ),
    ])

    return {
      attachedCount: toActivate.length,
      detachedCount: diff.toDetach.length,
    }
  }

  async countReaderUploadsSince(
    readerId: string,
    since: Date,
  ): Promise<number> {
    return this.fileReferenceRepository.countReaderUploadsSince(readerId, since)
  }

  async sumReaderActiveBytes(readerId: string): Promise<number> {
    return this.fileReferenceRepository.sumReaderActiveBytes(readerId)
  }

  /**
   * Core hard-delete flow: remove the storage object first, then delete the
   * record. Deletion audits are emitted only as structured logs to stdout.
   */
  async hardDeleteFile(
    file: FileReferenceRow,
    reason: FileDeletionReason,
  ): Promise<{ storageRemoved: boolean }> {
    let storageRemoved = false
    let storageError: string | undefined

    try {
      if (file.s3ObjectKey) {
        const uploader = await this.buildS3Uploader()
        if (uploader) {
          await uploader.deleteObject(file.s3ObjectKey)
          storageRemoved = true
        } else {
          storageError = 'S3 not configured'
        }
      } else {
        storageRemoved = await this.unlinkLocalFile(file)
        if (!storageRemoved) storageError = 'unknown storage backend'
      }
    } catch (err) {
      storageError = err instanceof Error ? err.message : String(err)
    }

    await this.fileReferenceRepository.deleteById(file.id)

    const logPayload = {
      event: 'file_hard_delete',
      reason,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      s3ObjectKey: file.s3ObjectKey ?? null,
      byteSize: file.byteSize ?? null,
      uploadedBy: file.uploadedBy ?? FileUploadedBy.Owner,
      readerId: file.readerId ?? null,
      refType: file.refType ?? null,
      refId: file.refId ?? null,
      storageRemoved,
      storageError: storageError ?? null,
    }
    if (storageError) {
      this.logger.warn(JSON.stringify(logPayload))
    } else {
      this.logger.log(JSON.stringify(logPayload))
    }
    return { storageRemoved }
  }

  /**
   * Cascade-delete every file (reader uploads) attached to a comment.
   */
  async hardDeleteFilesForComment(
    commentId: string,
    reason: FileDeletionReason,
  ): Promise<number> {
    const files = await this.fileReferenceRepository.findByCommentId(commentId)
    let deleted = 0
    for (const file of files) {
      try {
        await this.hardDeleteFile(file, reason)
        deleted++
      } catch (err) {
        this.logger.warn(
          `cascade delete failed for ${file.fileName}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
    return deleted
  }

  private async hardDeleteBatch(
    files: FileReferenceRow[],
    reason: FileDeletionReason,
    label: string,
  ): Promise<number> {
    let deleted = 0
    for (const file of files) {
      try {
        await this.hardDeleteFile(file, reason)
        deleted++
      } catch (err) {
        this.logger.warn(
          `${label} cleanup failed for ${file.fileName}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
    return deleted
  }

  /**
   * Cleanup pass dedicated to comment uploads: two passes over pending TTL
   * and detached TTL.
   */
  async cleanupCommentUploads(): Promise<{
    pendingDeleted: number
    detachedDeleted: number
  }> {
    const config = await this.configsService.get('commentUploadOptions')
    const pendingTtlMinutes = config.pendingTtlMinutes ?? 120
    const detachedTtlMinutes = config.detachedTtlMinutes ?? 30

    const pendingCutoff = new Date(Date.now() - pendingTtlMinutes * 60 * 1000)
    const detachedCutoff = new Date(Date.now() - detachedTtlMinutes * 60 * 1000)

    const pendingFiles =
      await this.fileReferenceRepository.findReaderPendingOlderThan(
        pendingCutoff,
      )
    const pendingDeleted = await this.hardDeleteBatch(
      pendingFiles,
      FileDeletionReason.PendingTtl,
      'pending TTL',
    )

    const detachedFiles =
      await this.fileReferenceRepository.findReaderDetachedOlderThan(
        detachedCutoff,
      )
    const detachedDeleted = await this.hardDeleteBatch(
      detachedFiles,
      FileDeletionReason.DetachedTtl,
      'detached TTL',
    )

    if (pendingDeleted + detachedDeleted > 0) {
      this.logger.log(
        `cleanupCommentUploads pending=${pendingDeleted} detached=${detachedDeleted}`,
      )
    }

    return { pendingDeleted, detachedDeleted }
  }

  /**
   * Cleanup pass for owner uploads. A file is deleted only when no persisted
   * module contains its URL, regardless of the representative refId/status.
   */
  async cleanupOrphanFiles(maxAgeMinutes = 60) {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const candidates =
      await this.fileReferenceRepository.findOwnerReferencesOlderThan(
        cutoffTime,
      )
    const orphanFiles = await this.filterIsolatedFiles(candidates)

    const s3Uploader = await this.buildS3Uploader()
    let deletedCount = 0

    for (const file of orphanFiles) {
      try {
        if (file.s3ObjectKey) {
          if (!s3Uploader) {
            this.logger.warn(`S3 not configured, skip: ${file.fileName}`)
            continue
          }
          await s3Uploader.deleteObject(file.s3ObjectKey)
        } else if (!(await this.unlinkLocalFile(file))) {
          continue
        }
        await this.fileReferenceRepository.deleteById(file.id)
        deletedCount++
        this.logger.log(`Deleted orphan file: ${file.fileName}`)
      } catch {
        this.logger.warn(`Failed to delete orphan file: ${file.fileName}`)
      }
    }

    return { deletedCount, totalOrphan: orphanFiles.length }
  }

  async getFileReferences(fileUrl: string) {
    return this.fileReferenceRepository.findByUrl(fileUrl)
  }

  async getReferencesForDocument(refId: string, refType: FileReferenceType) {
    return (
      await this.fileReferenceRepository.findByRef(refType, refId)
    ).filter((row) => row.status === FileReferenceStatus.Active)
  }

  async getOrphanFilesCount() {
    return this.fileReferenceRepository.countOrphans()
  }

  async listOrphanFiles(page = 1, size = 20) {
    return this.fileReferenceRepository.listOrphans(page, size)
  }

  async listReaderUploads(params: {
    page: number
    size: number
    status?: FileReferenceStatus
    readerId?: string
    refId?: string
  }) {
    const result = await this.fileReferenceRepository.listReaderUploads(params)
    return {
      files: result.data,
      total: result.pagination.total,
      pagination: result.pagination,
    }
  }

  async getReferenceById(id: string) {
    return this.fileReferenceRepository.findById(id)
  }

  async batchDeleteOrphans(options: { ids?: string[]; all?: boolean }) {
    const s3Uploader = await this.buildS3Uploader()

    const deleteFile = async (file: FileReferenceRow): Promise<boolean> => {
      if (file.s3ObjectKey) {
        if (!s3Uploader) return false
        await s3Uploader.deleteObject(file.s3ObjectKey)
        return true
      }
      return this.unlinkLocalFile(file)
    }

    if (options.all) {
      const candidates =
        await this.fileReferenceRepository.findOwnerReferences()
      const orphanFiles = await this.filterIsolatedFiles(candidates)

      let deletedCount = 0
      for (const file of orphanFiles) {
        try {
          if (await deleteFile(file)) {
            await this.fileReferenceRepository.deleteById(file.id)
            deletedCount++
          }
        } catch {
          this.logger.warn(`Failed to delete orphan: ${file.fileName}`)
        }
      }
      return { deletedCount }
    }

    if (options.ids?.length) {
      const candidates = (
        await Promise.all(
          options.ids.map((id) => this.fileReferenceRepository.findById(id)),
        )
      ).filter(
        (ref): ref is FileReferenceRow =>
          !!ref && ref.uploadedBy !== FileUploadedBy.Reader,
      )
      const orphanFiles = await this.filterIsolatedFiles(candidates)
      let deletedCount = 0
      for (const ref of orphanFiles) {
        try {
          if (await deleteFile(ref)) {
            await this.fileReferenceRepository.deleteById(ref.id)
            deletedCount++
          }
        } catch {
          this.logger.warn(`Failed to delete orphan: ${ref.fileName}`)
        }
      }
      return { deletedCount }
    }

    return { deletedCount: 0 }
  }

  private async filterIsolatedFiles(
    candidates: FileReferenceRow[],
  ): Promise<FileReferenceRow[]> {
    if (candidates.length === 0) return []
    const referencedUrls =
      await this.fileReferenceUsageRepository.findReferencedUrls(
        candidates.map((file) => file.fileUrl),
      )
    return candidates.filter((file) => !referencedUrls.has(file.fileUrl))
  }

  private async buildS3Uploader(): Promise<S3Uploader | null> {
    const config = await this.configsService.get('imageStorageOptions')
    if (
      !config.enable ||
      !config.endpoint ||
      !config.secretId ||
      !config.secretKey ||
      !config.bucket
    ) {
      return null
    }
    const uploader = new S3Uploader({
      endpoint: config.endpoint,
      accessKey: config.secretId,
      secretKey: config.secretKey,
      bucket: config.bucket,
      region: config.region || 'auto',
    })
    if (config.customDomain) {
      uploader.setCustomDomain(config.customDomain)
    }
    return uploader
  }
}
