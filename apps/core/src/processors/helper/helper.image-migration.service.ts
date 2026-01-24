import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { ImageModel } from '~/shared/model/image.model'
import { S3Uploader } from '~/utils/s3.util'
import { lookup } from 'mime-types'

export interface ImageMigrationResult {
  newText: string
  newImages: ImageModel[]
  migratedCount: number
}

@Injectable()
export class ImageMigrationService {
  private readonly logger = new Logger(ImageMigrationService.name)

  constructor(private readonly configsService: ConfigsService) {}

  isLocalImage(url: string): boolean {
    return url.includes('/objects/image/')
  }

  extractLocalImageFilename(url: string): string | null {
    const match = url.match(/\/objects\/image\/([^/?#]+)/)
    return match ? match[1] : null
  }

  async migrateImagesToS3(
    text: string,
    images?: ImageModel[],
  ): Promise<ImageMigrationResult> {
    const config = await this.configsService.get('imageStorageOptions')

    if (!config.enable) {
      return { newText: text, newImages: images ?? [], migratedCount: 0 }
    }

    if (
      !config.endpoint ||
      !config.secretId ||
      !config.secretKey ||
      !config.bucket
    ) {
      this.logger.warn('Image storage config incomplete, skipping migration')
      return { newText: text, newImages: images ?? [], migratedCount: 0 }
    }

    const s3Uploader = new S3Uploader({
      endpoint: config.endpoint,
      accessKey: config.secretId,
      secretKey: config.secretKey,
      bucket: config.bucket,
      region: config.region || 'auto',
    })

    if (config.customDomain) {
      s3Uploader.setCustomDomain(config.customDomain)
    }

    const localImageRegex = /!\[([^\]]*)\]\(([^)]*\/objects\/image\/[^)]+)\)/g
    const matches = [...text.matchAll(localImageRegex)]

    let newText = text
    const newImages = [...(images ?? [])]
    let migratedCount = 0

    for (const match of matches) {
      const [fullMatch, altText, imageUrl] = match
      const filename = this.extractLocalImageFilename(imageUrl)

      if (!filename) continue

      try {
        const localPath = path.join(STATIC_FILE_DIR, 'image', filename)
        const buffer = await readFile(localPath)
        const contentType = lookup(filename) || 'application/octet-stream'

        const objectKey = config.prefix
          ? `${config.prefix.replace(/\/+$/, '')}/${filename}`
          : filename

        const s3Url = await s3Uploader.uploadBuffer(
          buffer,
          objectKey,
          contentType,
        )

        newText = newText.replace(fullMatch, `![${altText}](${s3Url})`)

        const imageIndex = newImages.findIndex((img) => img.src === imageUrl)
        if (imageIndex !== -1) {
          newImages[imageIndex] = { ...newImages[imageIndex], src: s3Url }
        }

        migratedCount++
        this.logger.log(`Migrated image: ${filename} -> ${s3Url}`)

        if (config.deleteLocalAfterSync) {
          try {
            await unlink(localPath)
            this.logger.log(`Deleted local file: ${localPath}`)
          } catch (deleteError) {
            this.logger.warn(
              `Failed to delete local file: ${localPath}`,
              deleteError,
            )
          }
        }
      } catch (error) {
        this.logger.error(`Failed to migrate image: ${filename}`, error)
      }
    }

    return { newText, newImages, migratedCount }
  }
}
