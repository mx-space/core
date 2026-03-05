import { unlink } from 'node:fs/promises'
import path from 'node:path'

import { Injectable, Logger } from '@nestjs/common'

import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { ContentFormat } from '~/shared/types/content-format.type'
import { InjectModel } from '~/transformers/model.transformer'
import { extractImagesFromContent } from '~/utils/content.util'
import { S3Uploader } from '~/utils/s3.util'

import {
  FileReferenceModel,
  FileReferenceStatus,
  FileReferenceType,
} from './file-reference.model'

interface ContentLike {
  text: string
  contentFormat?: ContentFormat | string
  content?: string
}

@Injectable()
export class FileReferenceService {
  private readonly logger = new Logger(FileReferenceService.name)

  constructor(
    @InjectModel(FileReferenceModel)
    private readonly fileReferenceModel: MongooseModel<FileReferenceModel>,
    private readonly configsService: ConfigsService,
  ) {}

  get model() {
    return this.fileReferenceModel
  }

  async createPendingReference(
    fileUrl: string,
    fileName: string,
    s3ObjectKey?: string,
  ) {
    const existing = await this.fileReferenceModel.findOne({ fileUrl })
    if (existing) {
      return existing
    }

    return this.fileReferenceModel.create({
      fileUrl,
      fileName,
      status: FileReferenceStatus.Pending,
      ...(s3ObjectKey && { s3ObjectKey }),
    })
  }

  async activateReferences(
    doc: ContentLike,
    refId: string,
    refType: FileReferenceType,
  ) {
    const imageUrls = extractImagesFromContent(doc)
    if (imageUrls.length === 0) return

    await this.fileReferenceModel.updateMany(
      {
        fileUrl: { $in: imageUrls },
      },
      {
        $set: {
          status: FileReferenceStatus.Active,
          refId,
          refType,
        },
      },
    )
  }

  async updateReferencesForDocument(
    doc: ContentLike,
    refId: string,
    refType: FileReferenceType,
  ) {
    const imageUrls = extractImagesFromContent(doc)

    await this.fileReferenceModel.updateMany(
      { refId, refType },
      { $set: { status: FileReferenceStatus.Pending, refId: null } },
    )

    if (imageUrls.length > 0) {
      for (const fileUrl of imageUrls) {
        await this.fileReferenceModel.updateOne(
          { fileUrl },
          {
            $set: {
              status: FileReferenceStatus.Active,
              refId,
              refType,
            },
          },
        )
      }
    }
  }

  async removeReferencesForDocument(refId: string, refType: FileReferenceType) {
    await this.fileReferenceModel.updateMany(
      { refId, refType },
      { $set: { status: FileReferenceStatus.Pending, refId: null } },
    )
  }

  async cleanupOrphanFiles(maxAgeMinutes = 60) {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const orphanFiles = await this.fileReferenceModel.find({
      status: FileReferenceStatus.Pending,
      created: { $lt: cutoffTime },
    })

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
          const localPath = path.join(STATIC_FILE_DIR, 'image', file.fileName)
          await unlink(localPath)
        } else {
          continue
        }
        await this.fileReferenceModel.deleteOne({ _id: file._id })
        deletedCount++
        this.logger.log(`Deleted orphan file: ${file.fileName}`)
      } catch {
        this.logger.warn(`Failed to delete orphan file: ${file.fileName}`)
      }
    }

    return { deletedCount, totalOrphan: orphanFiles.length }
  }

  async getFileReferences(fileUrl: string) {
    return this.fileReferenceModel.find({ fileUrl })
  }

  async getReferencesForDocument(refId: string, refType: FileReferenceType) {
    return this.fileReferenceModel.find({
      refId,
      refType,
      status: FileReferenceStatus.Active,
    })
  }

  async getOrphanFilesCount() {
    return this.fileReferenceModel.countDocuments({
      status: FileReferenceStatus.Pending,
    })
  }

  async batchDeleteOrphans(options: { ids?: string[]; all?: boolean }) {
    const s3Uploader = await this.buildS3Uploader()

    const deleteFile = async (file: FileReferenceModel): Promise<boolean> => {
      if (file.s3ObjectKey) {
        if (!s3Uploader) return false
        await s3Uploader.deleteObject(file.s3ObjectKey)
        return true
      }
      if (file.fileUrl.includes('/objects/image/')) {
        const localPath = path.join(STATIC_FILE_DIR, 'image', file.fileName)
        await unlink(localPath)
        return true
      }
      return false
    }

    if (options.all) {
      const orphanFiles = await this.fileReferenceModel.find({
        status: FileReferenceStatus.Pending,
      })

      let deletedCount = 0
      for (const file of orphanFiles) {
        try {
          if (await deleteFile(file)) {
            await this.fileReferenceModel.deleteOne({ _id: file._id })
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
        const ref = await this.fileReferenceModel.findById(id)
        if (ref && ref.status === FileReferenceStatus.Pending) {
          try {
            if (await deleteFile(ref)) {
              await this.fileReferenceModel.deleteOne({ _id: id })
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
