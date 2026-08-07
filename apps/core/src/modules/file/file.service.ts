import { createReadStream, createWriteStream } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises'
import path, { resolve } from 'node:path'
import { Readable } from 'node:stream'

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import {
  STATIC_FILE_DIR,
  STATIC_FILE_TRASH_DIR,
} from '~/constants/path.constant'
import {
  generateFilename,
  generateFilePath,
  replaceFilenameTemplate,
} from '~/utils/filename-template.util'
import { S3Uploader } from '~/utils/s3.util'

import { ConfigsService } from '../configs/configs.service'
import type { FileType } from './file.type'
import { FileReferenceService } from './file-reference.service'

@Injectable()
export class FileService {
  private readonly logger: Logger
  constructor(
    private readonly configService: ConfigsService,
    private readonly fileReferenceService: FileReferenceService,
  ) {
    this.logger = new Logger(FileService.name)
  }

  private resolveFilePath(type: FileType, name: string) {
    const base = path.resolve(STATIC_FILE_DIR, type)
    const resolved = path.resolve(base, name)
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'invalid file path',
      })
    }
    return resolved
  }

  private async checkIsExist(path: string) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  async getFileStream(type: FileType, name: string) {
    const filePath = this.resolveFilePath(type, name)
    const exists = await this.checkIsExist(filePath)
    if (!exists) {
      throw createAppException(AppErrorCode.FILE_NOT_FOUND, { name })
    }
    return createReadStream(filePath)
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
        reject(createAppException(AppErrorCode.FILE_EXISTS))
        return
      }
      await mkdir(path.dirname(filePath), { recursive: true })

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

  async writeTrackedOwnerFile(
    type: FileType,
    name: string,
    data: Readable,
  ): Promise<string> {
    await this.writeFile(type, name, data)
    const fileUrl = await this.resolveFileUrl(type, name)
    await this.fileReferenceService.createPendingReference(fileUrl, name)
    return fileUrl
  }

  updateFile(
    type: FileType,
    name: string,
    data: Readable,
    encoding?: BufferEncoding,
  ) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const filePath = this.resolveFilePath(type, name)
      if (!(await this.checkIsExist(filePath))) {
        reject(createAppException(AppErrorCode.FILE_NOT_FOUND, { name }))
        return
      }
      const writable = createWriteStream(filePath, { encoding })
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

  async deleteFile(type: FileType, name: string) {
    const sourcePath = this.resolveFilePath(type, name)
    const trashPath = resolve(STATIC_FILE_TRASH_DIR, name)

    try {
      await mkdir(STATIC_FILE_TRASH_DIR, { recursive: true })

      await copyFile(sourcePath, trashPath)

      try {
        await unlink(sourcePath)
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error
        }
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        // Idempotent: if the source file is missing, treat it as already deleted.
        this.logger.warn(
          `Delete file: source missing, skipping (${type}/${name})`,
        )
        return
      }
      this.logger.error('Failed to delete file', error)

      throw new InternalServerErrorException(
        `Failed to delete file: ${error.message}`,
      )
    }
  }

  async getDir(type: FileType) {
    const dirPath = this.resolveFilePath(type, '')
    await mkdir(dirPath, { recursive: true })
    return readdir(dirPath)
  }

  async resolveFileUrl(type: FileType, name: string) {
    const { serverUrl } = await this.configService.get('url')
    return `${serverUrl.replace(/\/+$/, '')}/objects/${type}/${name}`
  }

  async renameFile(type: FileType, name: string, newName: string) {
    const oldPath = this.resolveFilePath(type, name)
    const newPath = this.resolveFilePath(type, newName)
    try {
      await rename(oldPath, newPath)
    } catch (error) {
      this.logger.error('Failed to rename file', error.message)
      throw createAppException(AppErrorCode.FILE_RENAME_FAILED)
    }
  }

  async deleteObject(backend: 's3' | 'local', key: string): Promise<void> {
    if (backend === 'local') {
      try {
        await unlink(this.resolveFilePath('audio', key))
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      return
    }

    const config = await this.configService.get('imageStorageOptions')
    if (
      !config?.endpoint ||
      !config.secretId ||
      !config.secretKey ||
      !config.bucket
    ) {
      throw createAppException(AppErrorCode.FILE_STORAGE_NOT_CONFIGURED)
    }

    const s3Uploader = new S3Uploader({
      endpoint: config.endpoint,
      accessKey: config.secretId,
      secretKey: config.secretKey,
      bucket: config.bucket,
      region: config.region || 'auto',
    })
    await s3Uploader.deleteObject(key)
  }

  async uploadBuffer(
    buffer: Buffer,
    opts: {
      type: FileType
      originalFilename?: string
      contentType: string
      objectKey?: string
    },
  ): Promise<{
    url: string
    name: string
    storageBackend: 's3' | 'local'
    storageKey: string
  }> {
    const {
      type,
      originalFilename = '',
      contentType,
      objectKey: explicitObjectKey,
    } = opts

    const uploadConfig = await this.configService.get('fileUploadOptions')
    const imageStorageConfig = await this.configService.get(
      'imageStorageOptions',
    )
    const s3Enabled = imageStorageConfig?.enable === true

    if (
      s3Enabled &&
      (type === 'image' ||
        type === 'file' ||
        type === 'video' ||
        type === 'audio')
    ) {
      const config = imageStorageConfig!
      if (
        !config.endpoint ||
        !config.secretId ||
        !config.secretKey ||
        !config.bucket
      ) {
        throw createAppException(AppErrorCode.FILE_STORAGE_NOT_CONFIGURED)
      }

      let objectKey: string
      let filename: string
      if (explicitObjectKey) {
        objectKey = explicitObjectKey
        filename = path.basename(explicitObjectKey)
      } else {
        filename = generateFilename(uploadConfig, {
          originalFilename,
          fileType: type,
        })

        let prefixPath = ''
        if (config.prefix) {
          prefixPath = replaceFilenameTemplate(config.prefix, {
            originalFilename,
            fileType: type,
          })
          prefixPath = prefixPath.replace(/\/+$/, '')
        }

        objectKey = prefixPath ? `${prefixPath}/${filename}` : filename
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

      const s3Url = await s3Uploader.uploadBuffer(
        buffer,
        objectKey,
        contentType,
      )

      await this.fileReferenceService.createPendingReference(
        s3Url,
        filename,
        objectKey,
      )

      return {
        url: s3Url,
        name: filename,
        storageBackend: 's3',
        storageKey: objectKey,
      }
    }

    let relativePath: string
    if (explicitObjectKey) {
      relativePath = explicitObjectKey
    } else {
      const rawFilename = generateFilename(uploadConfig, {
        originalFilename,
        fileType: type,
      })

      const basePath = generateFilePath(uploadConfig, {
        originalFilename,
        fileType: type,
      })

      if (basePath === type || !basePath) {
        relativePath = rawFilename
      } else {
        const pathWithoutType = basePath.startsWith(`${type}/`)
          ? basePath.slice(Math.max(0, type.length + 1))
          : basePath
        relativePath = path.join(pathWithoutType, rawFilename)
      }
    }

    const fileUrl = await this.writeTrackedOwnerFile(
      type,
      relativePath,
      Readable.from(buffer),
    )

    return {
      url: fileUrl,
      name: path.basename(relativePath),
      storageBackend: 'local',
      storageKey: relativePath,
    }
  }
}
