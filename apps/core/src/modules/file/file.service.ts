import { createWriteStream } from 'node:fs'
import path, { resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { fs } from '@mx-space/compiled'
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  STATIC_FILE_DIR,
  STATIC_FILE_TRASH_DIR,
} from '~/constants/path.constant'
import { S3Uploader } from '~/utils/s3.util'
import { lookup } from 'mime-types'
import { ConfigsService } from '../configs/configs.service'
import type {
  FunctionContextRequest,
  FunctionContextResponse,
} from '../serverless/function.types'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetType } from '../snippet/snippet.model'
import type { FileType } from './file.type'

const IMAGE_UPLOAD_FUNCTION_REFERENCE = 'file'
const IMAGE_UPLOAD_FUNCTION_NAME = 'editor-image-upload'

@Injectable()
export class FileService {
  private readonly logger: Logger
  constructor(
    private readonly configService: ConfigsService,
    private readonly serverlessService: ServerlessService,
  ) {
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

  async uploadImageWithConfig(
    buffer: Buffer,
    ext: string,
    filename: string,
  ): Promise<string> {
    const config = await this.configService.get('imageUploadOptions')

    if (config.provider === 'none') {
      throw new BadRequestException('图片上传功能未开启')
    }

    switch (config.provider) {
      case 's3': {
        if (
          !config.s3Bucket ||
          !config.s3Region ||
          !config.s3SecretId ||
          !config.s3SecretKey
        ) {
          throw new BadRequestException('S3 配置不完整')
        }

        const s3 = new S3Uploader({
          bucket: config.s3Bucket,
          region: config.s3Region,
          accessKey: config.s3SecretId,
          secretKey: config.s3SecretKey,
          endpoint: config.s3Endpoint,
        })
        if (config.s3PublicUrlPrefix) {
          s3.setCustomDomain(config.s3PublicUrlPrefix)
        }

        const imagePath = config.s3PathPrefix || 'images/'
        return await s3.uploadImage(buffer, imagePath)
      }

      case 'custom': {
        return await this.uploadViaServerlessFunction(buffer, ext, filename)
      }

      default:
        throw new BadRequestException('不支持的上传方式')
    }
  }

  private async uploadViaServerlessFunction(
    buffer: Buffer,
    ext: string,
    filename: string,
  ): Promise<string> {
    const snippet = await this.serverlessService.model
      .findOne({
        reference: IMAGE_UPLOAD_FUNCTION_REFERENCE,
        name: IMAGE_UPLOAD_FUNCTION_NAME,
        type: SnippetType.Function,
      })
      .select('+secret')
      .lean({
        getters: true,
      })

    if (!snippet || !snippet.enable) {
      throw new BadRequestException('云函数上传未配置或未启用')
    }

    const request = this.createServerlessRequest(buffer, ext, filename)
    const response = this.createServerlessResponse()

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        snippet,
        {
          req: request,
          res: response,
          isAuthenticated: true,
        },
      )

    const resolved = this.extractUrlFromServerlessResult(result)
    if (!resolved) {
      throw new InternalServerErrorException('云函数未返回有效的 URL')
    }

    return resolved
  }

  private createServerlessRequest(
    buffer: Buffer,
    ext: string,
    filename: string,
  ): FunctionContextRequest {
    const mimetype = lookup(ext) || 'application/octet-stream'

    return {
      method: 'POST',
      url: `/serverless/${IMAGE_UPLOAD_FUNCTION_REFERENCE}/${IMAGE_UPLOAD_FUNCTION_NAME}`,
      headers: {
        'content-type': 'application/json',
      },
      body: {
        filename,
        ext,
        mimetype,
        size: buffer.length,
        buffer: buffer.toString('base64'),
      },
      params: {},
      query: {},
    } as FunctionContextRequest
  }

  private createServerlessResponse(): FunctionContextResponse {
    const response: FunctionContextResponse = {
      throws(code, message) {
        throw new HttpException(message, code)
      },
      type() {
        return response
      },
      status() {
        return response
      },
      send(data: any) {
        return data
      },
    }

    return response
  }

  private extractUrlFromServerlessResult(result: any): string | null {
    if (typeof result === 'string' && result.length > 0) {
      return result
    }

    if (
      result &&
      typeof result === 'object' &&
      typeof result.url === 'string' &&
      result.url.length > 0
    ) {
      return result.url
    }

    return null
  }
}
