import { createWriteStream } from 'fs'
import { Readable } from 'stream'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { STATIC_FILE_DIR } from '~/constants/path.constant'

import { ConfigsService } from '../configs/configs.service'
import { FileType } from './file.type'

@Injectable()
export class FileService {
  constructor(private readonly configService: ConfigsService) {}

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
      return await fs.unlink(this.resolveFilePath(type, name))
    } catch {
      return null
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
}
