import { unlink } from 'node:fs/promises'
import path from 'node:path'

import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { ContentFormat } from '~/shared/types/content-format.type'
import { extractImagesFromContent } from '~/utils/content.util'
import { pickImagesFromMarkdown } from '~/utils/pic.util'
import { S3Uploader } from '~/utils/s3.util'

import {
  FileDeletionReason,
  FileReferenceRepository,
  type FileReferenceRow,
  FileReferenceStatus,
  type FileReferenceType,
  FileUploadedBy,
} from './file-reference.repository'

interface ContentLike {
  text: string
  contentFormat?: ContentFormat | string
  content?: string
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

  private isEnoent(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    )
  }

  /**
   * 删除本地图片文件。若磁盘上已不存在（ENOENT），视为已清理成功。
   */
  private async unlinkLocalImage(fileName: string): Promise<void> {
    const localPath = path.join(STATIC_FILE_DIR, 'image', fileName)
    try {
      await unlink(localPath)
    } catch (err) {
      if (this.isEnoent(err)) {
        return
      }
      throw err
    }
  }

  constructor(
    private readonly fileReferenceRepository: FileReferenceRepository,
    private readonly configsService: ConfigsService,
  ) {}

  private toLegacy(row: FileReferenceRow): FileReferenceRow & {
    _id: string
    created: Date
  } {
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
    }
  }

  async createPendingReference(
    fileUrl: string,
    fileName: string,
    s3ObjectKey?: string,
  ) {
    const existing = await this.fileReferenceRepository.findFirstByUrl(fileUrl)
    if (existing) {
      return this.toLegacy(existing)
    }

    return this.toLegacy(
      await this.fileReferenceRepository.create({
        fileUrl,
        fileName,
        status: FileReferenceStatus.Pending,
        s3ObjectKey,
      }),
    )
  }

  async createReaderPendingReference(input: {
    fileUrl: string
    fileName: string
    readerId: string
    mimeType: string
    byteSize: number
    s3ObjectKey?: string | null
  }) {
    return this.toLegacy(
      await this.fileReferenceRepository.create({
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        status: FileReferenceStatus.Pending,
        readerId: input.readerId,
        uploadedBy: FileUploadedBy.Reader,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        s3ObjectKey: input.s3ObjectKey ?? null,
      }),
    )
  }

  async activateReferences(
    doc: ContentLike,
    refId: string,
    refType: FileReferenceType,
  ) {
    const imageUrls = extractImagesFromContent(doc)
    if (imageUrls.length === 0) return

    await this.fileReferenceRepository.activateByUrls(imageUrls, refType, refId)
  }

  async updateReferencesForDocument(
    doc: ContentLike,
    refId: string,
    refType: FileReferenceType,
  ) {
    const imageUrls = extractImagesFromContent(doc)

    await this.fileReferenceRepository.markDocumentPending(refType, refId)

    if (imageUrls.length > 0) {
      for (const fileUrl of imageUrls) {
        await this.fileReferenceRepository.activateUrl(fileUrl, refType, refId)
      }
    }
  }

  async removeReferencesForDocument(refId: string, refType: FileReferenceType) {
    await this.fileReferenceRepository.markDocumentPending(refType, refId)
  }

  /**
   * 解析评论 markdown 中之图片 URL，仅返回属本站 host 之 URL。
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
   * 收集本站允许之图片 host：webUrl/serverUrl/customDomain。
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
   * 计算评论 update 时之 attach/detach/revive 三类文件。
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
        ref.refType === 'comment'
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
   * 评论 create / update 时之 attach。
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
      throw new BizException(ErrorCodeEnum.CommentImageCapExceeded)
    }

    if (newUrls.length === 0 && mode === 'create') {
      return { attachedCount: 0, detachedCount: 0 }
    }

    const candidates = await this.findReferencesByUrls(newUrls)

    for (const ref of candidates) {
      if (ref.uploadedBy !== FileUploadedBy.Reader) continue
      if (ref.readerId && ref.readerId !== readerId) {
        throw new BizException(ErrorCodeEnum.CommentUploadFileNotOwned)
      }
    }

    for (const ref of candidates) {
      if (ref.status !== FileReferenceStatus.Active) continue
      if (ref.refType === 'comment' && ref.refId === commentId) {
        continue
      }
      throw new BizException(ErrorCodeEnum.CommentUploadFileAlreadyBound)
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

    let attachedCount = 0
    for (const ref of diff.toAttach) {
      await this.fileReferenceRepository.markActive(
        ref.id,
        commentId,
        'comment',
      )
      attachedCount++
    }
    for (const ref of diff.toRevive) {
      await this.fileReferenceRepository.markActive(
        ref.id,
        commentId,
        'comment',
      )
      attachedCount++
    }
    let detachedCount = 0
    for (const ref of diff.toDetach) {
      await this.fileReferenceRepository.markDetached(ref.id)
      detachedCount++
    }

    return { attachedCount, detachedCount }
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
   * 硬删之核心：删 storage 对象 → 删 record。删除审计仅落 stdout 结构化日志。
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
      } else if (file.fileUrl?.includes('/objects/image/')) {
        await this.unlinkLocalImage(file.fileName)
        storageRemoved = true
      } else {
        storageError = 'unknown storage backend'
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
   * 级联清除某评论挂之全部文件（reader uploads）。
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

  /**
   * 评论上传专用清扫：pending TTL + detached TTL 双 pass。
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
    let pendingDeleted = 0
    for (const file of pendingFiles) {
      try {
        await this.hardDeleteFile(file, FileDeletionReason.PendingTtl)
        pendingDeleted++
      } catch (err) {
        this.logger.warn(
          `pending TTL cleanup failed for ${file.fileName}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }

    const detachedFiles =
      await this.fileReferenceRepository.findReaderDetachedOlderThan(
        detachedCutoff,
      )
    let detachedDeleted = 0
    for (const file of detachedFiles) {
      try {
        await this.hardDeleteFile(file, FileDeletionReason.DetachedTtl)
        detachedDeleted++
      } catch (err) {
        this.logger.warn(
          `detached TTL cleanup failed for ${file.fileName}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }

    if (pendingDeleted + detachedDeleted > 0) {
      this.logger.log(
        `cleanupCommentUploads pending=${pendingDeleted} detached=${detachedDeleted}`,
      )
    }

    return { pendingDeleted, detachedDeleted }
  }

  /**
   * Owner 路径之既有清扫：仅扫 uploadedBy != Reader 之 pending 文件。
   */
  async cleanupOrphanFiles(maxAgeMinutes = 60) {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const orphanFiles =
      await this.fileReferenceRepository.findOwnerPendingOlderThan(cutoffTime)

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
        } else if (file.fileUrl.includes('/objects/image/')) {
          await this.unlinkLocalImage(file.fileName)
        } else {
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
    return (await this.fileReferenceRepository.findByUrl(fileUrl)).map((row) =>
      this.toLegacy(row),
    )
  }

  async getReferencesForDocument(refId: string, refType: FileReferenceType) {
    return (await this.fileReferenceRepository.findByRef(refType, refId))
      .filter((row) => row.status === FileReferenceStatus.Active)
      .map((row) => this.toLegacy(row))
  }

  async getOrphanFilesCount() {
    return this.fileReferenceRepository.countPending()
  }

  async listOrphanFiles(page = 1, size = 20) {
    const result = await this.fileReferenceRepository.listOrphans(page, size)
    return {
      data: result.data.map((row) => this.toLegacy(row)),
      pagination: result.pagination,
    }
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
      files: result.data.map((row) => this.toLegacy(row)),
      total: result.pagination.total,
      pagination: result.pagination,
    }
  }

  async getReferenceById(id: string) {
    const row = await this.fileReferenceRepository.findById(id)
    return row ? this.toLegacy(row) : null
  }

  async batchDeleteOrphans(options: { ids?: string[]; all?: boolean }) {
    const s3Uploader = await this.buildS3Uploader()

    const deleteFile = async (file: FileReferenceRow): Promise<boolean> => {
      if (file.s3ObjectKey) {
        if (!s3Uploader) return false
        await s3Uploader.deleteObject(file.s3ObjectKey)
        return true
      }
      if (file.fileUrl.includes('/objects/image/')) {
        await this.unlinkLocalImage(file.fileName)
        return true
      }
      return false
    }

    if (options.all) {
      const orphanFiles = await this.fileReferenceRepository.findPending()

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
      let deletedCount = 0
      for (const id of options.ids) {
        const ref = await this.fileReferenceRepository.findById(id)
        if (ref && ref.status === FileReferenceStatus.Pending) {
          try {
            if (await deleteFile(ref)) {
              await this.fileReferenceRepository.deleteById(id)
              deletedCount++
            }
          } catch {
            this.logger.warn(`Failed to delete orphan: ${ref.fileName}`)
          }
        }
      }
      return { deletedCount }
    }

    return { deletedCount: 0 }
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
