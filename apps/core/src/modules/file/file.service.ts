import { createWriteStream } from 'node:fs'
import path, { resolve } from 'node:path'
import type { Readable } from 'node:stream'
import type { FileType } from './file.type'

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

import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class FileService {
  private readonly logger: Logger
  constructor(private readonly configService: ConfigsService) {
    this.logger = new Logger(FileService.name)
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

  async deleteFile(type: FileType, name: string) {
    try {
      const path = this.resolveFilePath(type, name)
      await fs.copyFile(path, resolve(STATIC_FILE_TRASH_DIR, name))
      await fs.unlink(path)
    } catch (error) {
      this.logger.error('删除文件失败', error)

      throw new InternalServerErrorException(`删除文件失败，${error.message}`)
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
