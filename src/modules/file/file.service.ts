import { createWriteStream } from 'fs'
import { Readable } from 'stream'

import { BadRequestException, Injectable } from '@nestjs/common'

import { API_VERSION } from '~/app.config'
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
    return fs
      .access(path)
      .then(() => true)
      .catch(() => false)
  }

  async getFile(type: FileType, name: string) {
    return await fs.readFile(this.resolveFilePath(type, name))
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

  deleteFile(type: FileType, name: string) {
    return fs.unlink(this.resolveFilePath(type, name)).catch(() => null)
  }

  getDir(type: FileType) {
    return fs
      .mkdir(this.resolveFilePath(type, ''), { recursive: true })
      .then(() => path.resolve(STATIC_FILE_DIR, type))
      .then((path) => fs.readdir(path))
  }

  async resolveFileUrl(type: FileType, name: string) {
    const { serverUrl } = await this.configService.get('url')
    return `${serverUrl}${
      isDev ? '' : `/api/v${API_VERSION}`
    }/objects/${type}/${name}`
  }
}
