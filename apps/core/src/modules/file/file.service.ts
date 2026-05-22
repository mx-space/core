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
import type { Readable } from 'node:stream'

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

import { ConfigsService } from '../configs/configs.service'
import type { FileType } from './file.type'

@Injectable()
export class FileService {
  private readonly logger: Logger
  constructor(private readonly configService: ConfigsService) {
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
}
