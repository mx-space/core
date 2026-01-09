import { createWriteStream } from 'node:fs'
import path, { resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { fs } from '@mx-space/compiled'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  STATIC_FILE_DIR,
  STATIC_FILE_TRASH_DIR,
} from '~/constants/path.constant'
import { parsePlaceholder } from '~/utils/path-placeholder.util'
import { S3Uploader } from '~/utils/s3.util'
import { ConfigsService } from '../configs/configs.service'
import type { FileType } from './file.type'

@Injectable()
export class FileService {
  private readonly logger: Logger
  constructor(private readonly configService: ConfigsService) {
    this.logger = new Logger(FileService.name)
  }

  async validateImageFile(filename: string, buffer: Buffer): Promise<void> {
    const { imageBedOptions } = await this.configService.waitForConfigReady()

    const ext = path.extname(filename).slice(1).toLowerCase()
    const allowedFormats = imageBedOptions?.allowedFormats
      ?.split(',')
      .map((f) => f.trim().toLowerCase())
    if (
      allowedFormats &&
      allowedFormats.length > 0 &&
      !allowedFormats.includes(ext)
    ) {
      throw new BadRequestException(
        `不支持的图片格式: ${ext}，允许的格式: ${imageBedOptions.allowedFormats}`,
      )
    }

    const maxSizeMB = imageBedOptions?.maxSizeMB || 10
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (buffer.length > maxSizeBytes) {
      throw new BadRequestException(
        `图片文件过大: ${(buffer.length / 1024 / 1024).toFixed(2)}MB，最大允许: ${maxSizeMB}MB`,
      )
    }
  }

  async uploadImageToS3(
    filename: string,
    buffer: Buffer,
  ): Promise<string | null> {
    const { imageBedOptions, s3Options } =
      await this.configService.waitForConfigReady()

    if (!imageBedOptions?.enable) {
      return null
    }

    const { endpoint, bucket, region, accessKeyId, secretAccessKey } =
      s3Options || {}
    if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 配置不完整，无法上传图片到 S3')
      return null
    }

    const ext = path.extname(filename).slice(1).toLowerCase()

    const s3 = new S3Uploader({
      bucket,
      region,
      accessKey: accessKeyId,
      secretKey: secretAccessKey,
      endpoint,
    })

    if (s3Options.customDomain) {
      s3.setCustomDomain(s3Options.customDomain)
    }

    const pathTemplate = imageBedOptions.path || 'images/{Y}/{m}/{uuid}.{ext}'
    const remotePath = parsePlaceholder(pathTemplate, {
      filename,
    })

    try {
      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      this.logger.log(`Uploading to S3: ${remotePath}`)
      await s3.uploadToS3(remotePath, buffer, contentType)
      this.logger.log(`Successfully uploaded to S3: ${remotePath}`)

      const baseUrl = s3Options.customDomain || endpoint
      return `${baseUrl.replace(/\/+$/, '')}/${remotePath}`
    } catch (error) {
      this.logger.error('Failed to upload to s3', error)
      throw new InternalServerErrorException(
        `上传图片到 S3 失败: ${error.message}`,
      )
    }
  }

  private resolveFilePath(type: FileType, name: string) {
    return path.resolve(STATIC_FILE_DIR, type, name)
  }

  private async checkIsExist(path: string) {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  async getFileStream(type: FileType, name: string) {
    const exists = await this.checkIsExist(this.resolveFilePath(type, name))
    if (!exists) {
      throw new NotFoundException('文件不存在')
    }
    return fs.createReadStream(this.resolveFilePath(type, name))
  }

  writeFile(
    type: FileType,
    name: string,
    data: Readable,
    encoding?: BufferEncoding,
  ) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const filePath = this.resolveFilePath(type, name)
      if (await this.checkIsExist(filePath)) {
        reject(new BadRequestException('文件已存在'))
        return
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      const writable = createWriteStream(filePath, {
        encoding,
      })
      data.pipe(writable)
      writable.on('close', () => {
        resolve(null)
      })
      writable.on('error', () => reject(null))
      data.on('end', () => {
        writable.end()
      })
      data.on('error', () => reject(null))
    })
  }

  async writeFileFromBuffer(
    type: FileType,
    name: string,
    buffer: Buffer,
  ): Promise<void> {
    const filePath = this.resolveFilePath(type, name)
    if (await this.checkIsExist(filePath)) {
      throw new BadRequestException('文件已存在')
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  async deleteFile(
    type: FileType,
    name: string,
    storage?: 'local' | 's3',
    url?: string,
  ) {
    try {
      if (storage === 's3') {
        await this.deleteFileFromS3(url)
      } else {
        const path = this.resolveFilePath(type, name)
        await fs.copyFile(path, resolve(STATIC_FILE_TRASH_DIR, name))
        await fs.unlink(path)
      }
    } catch (error) {
      this.logger.error('删除文件失败', error)

      throw new InternalServerErrorException(`删除文件失败，${error.message}`)
    }
  }

  async deleteFileFromS3(fileUrl?: string): Promise<void> {
    if (!fileUrl) {
      throw new BadRequestException('删除 S3 文件需要提供 URL')
    }

    const { imageBedOptions, s3Options } =
      await this.configService.waitForConfigReady()

    if (!imageBedOptions?.enable) {
      throw new InternalServerErrorException('S3 图床未启用')
    }

    const { endpoint, bucket, region, accessKeyId, secretAccessKey } =
      s3Options || {}
    if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException('S3 配置不完整')
    }

    const s3 = new S3Uploader({
      bucket,
      region,
      accessKey: accessKeyId,
      secretKey: secretAccessKey,
      endpoint,
    })

    let objectKey: string
    try {
      const urlObj = new URL(fileUrl)
      objectKey = urlObj.pathname.replace(/^\//, '') // 移除开头的斜杠
    } catch (error) {
      this.logger.error('解析 S3 URL 失败', error)
      throw new BadRequestException(`无效的 S3 URL: ${fileUrl}`)
    }

    try {
      this.logger.log(`Deleting from S3: ${objectKey}`)
      await s3.deleteFromS3(objectKey)
      this.logger.log(`Successfully deleted from S3: ${objectKey}`)
    } catch (error) {
      this.logger.error('Failed to delete from S3', error)
      throw new InternalServerErrorException(
        `从 S3 删除文件失败: ${error.message}`,
      )
    }
  }

  async getDir(type: FileType) {
    await fs.mkdir(this.resolveFilePath(type, ''), { recursive: true })
    const path_1 = path.resolve(STATIC_FILE_DIR, type)
    return await fs.readdir(path_1)
  }

  async resolveFileUrl(type: FileType, name: string) {
    const { serverUrl } = await this.configService.get('url')
    return `${serverUrl.replace(/\/+$/, '')}/objects/${type}/${name}`
  }

  async renameFile(type: FileType, name: string, newName: string) {
    const oldPath = this.resolveFilePath(type, name)
    const newPath = this.resolveFilePath(type, newName)
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      this.logger.error('重命名文件失败', error.message)
      throw new BadRequestException('重命名文件失败')
    }
  }
}
