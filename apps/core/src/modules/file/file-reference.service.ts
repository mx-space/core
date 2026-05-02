import { unlink } from 'node:fs/promises'
import path from 'node:path'

import { Injectable, Logger } from '@nestjs/common'

import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { ContentFormat } from '~/shared/types/content-format.type'
import { extractImagesFromContent } from '~/utils/content.util'
import { S3Uploader } from '~/utils/s3.util'

import {
  FileReferenceRepository,
  type FileReferenceRow,
  FileReferenceStatus,
  type FileReferenceType,
} from './file-reference.repository'

interface ContentLike {
  text: string
  contentFormat?: ContentFormat | string
  content?: string
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
   * 删除本地孤儿图片文件。若磁盘上已不存在（ENOENT），视为已清理成功，避免 DB 残留导致接口仍引用缺失文件。
   */
  private async unlinkLocalOrphanImage(fileName: string): Promise<void> {
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

  async cleanupOrphanFiles(maxAgeMinutes = 60) {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const orphanFiles =
      await this.fileReferenceRepository.findPendingOlderThan(cutoffTime)

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
          await this.unlinkLocalOrphanImage(file.fileName)
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
    const result = await this.fileReferenceRepository.listPending(page, size)
    return {
      data: result.data.map((row) => this.toLegacy(row)),
      pagination: result.pagination,
    }
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
        await this.unlinkLocalOrphanImage(file.fileName)
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
