import { access, unlink } from 'node:fs/promises'
import path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { InjectModel } from '~/transformers/model.transformer'
import { pickImagesFromMarkdown } from '~/utils/pic.util'
import {
  FileReferenceModel,
  FileReferenceStatus,
  FileReferenceType,
} from './file-reference.model'

@Injectable()
export class FileReferenceService {
  private readonly logger = new Logger(FileReferenceService.name)

  constructor(
    @InjectModel(FileReferenceModel)
    private readonly fileReferenceModel: MongooseModel<FileReferenceModel>,
  ) {}

  get model() {
    return this.fileReferenceModel
  }

  async createPendingReference(fileUrl: string, fileName: string) {
    const existing = await this.fileReferenceModel.findOne({ fileUrl })
    if (existing) {
      return existing
    }

    return this.fileReferenceModel.create({
      fileUrl,
      fileName,
      status: FileReferenceStatus.Pending,
    })
  }

  async activateReferences(
    text: string,
    refId: string,
    refType: FileReferenceType,
  ) {
    const imageUrls = pickImagesFromMarkdown(text)
    const localImageUrls = imageUrls.filter((url) =>
      url.includes('/objects/image/'),
    )

    if (localImageUrls.length === 0) return

    await this.fileReferenceModel.updateMany(
      {
        fileUrl: { $in: localImageUrls },
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
    text: string,
    refId: string,
    refType: FileReferenceType,
  ) {
    const imageUrls = pickImagesFromMarkdown(text)
    const localImageUrls = imageUrls.filter((url) =>
      url.includes('/objects/image/'),
    )

    await this.fileReferenceModel.updateMany(
      { refId, refType },
      { $set: { status: FileReferenceStatus.Pending, refId: null } },
    )

    if (localImageUrls.length > 0) {
      for (const fileUrl of localImageUrls) {
        await this.fileReferenceModel.updateOne(
          { fileUrl },
          {
            $set: {
              status: FileReferenceStatus.Active,
              refId,
              refType,
            },
          },
          { upsert: true },
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

    let deletedCount = 0
    for (const file of orphanFiles) {
      try {
        const localPath = path.join(STATIC_FILE_DIR, 'image', file.fileName)
        await unlink(localPath)
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

  private async deleteFileIfExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath)
      await unlink(filePath)
      return true
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return true
      }
      this.logger.warn(
        `Failed to delete file: ${filePath}, error: ${error.message}`,
      )
      return false
    }
  }

  async batchDeleteOrphans(options: { ids?: string[]; all?: boolean }) {
    if (options.all) {
      const orphanFiles = await this.fileReferenceModel.find({
        status: FileReferenceStatus.Pending,
      })

      let deletedCount = 0
      for (const file of orphanFiles) {
        const localPath = path.join(STATIC_FILE_DIR, 'image', file.fileName)
        const fileDeleted = await this.deleteFileIfExists(localPath)
        if (fileDeleted) {
          await this.fileReferenceModel.deleteOne({ _id: file._id })
          deletedCount++
        }
      }
      return { deletedCount }
    }

    if (options.ids?.length) {
      let deletedCount = 0
      for (const id of options.ids) {
        const ref = await this.fileReferenceModel.findById(id)
        if (ref && ref.status === FileReferenceStatus.Pending) {
          const filePath = path.join(STATIC_FILE_DIR, 'image', ref.fileName)
          const fileDeleted = await this.deleteFileIfExists(filePath)
          if (fileDeleted) {
            await this.fileReferenceModel.deleteOne({ _id: id })
            deletedCount++
          }
        }
      }
      return { deletedCount }
    }

    return { deletedCount: 0 }
  }
}
