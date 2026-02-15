import fs from 'node:fs/promises'
import path from 'node:path'
import {
  Body,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { PagerDto } from '~/shared/dto/pager.dto'
import {
  generateFilename,
  generateFilePath,
  replaceFilenameTemplate,
} from '~/utils/filename-template.util'
import { S3Uploader } from '~/utils/s3.util'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'
import { FileReferenceService } from './file-reference.service'
import {
  BatchOrphanDeleteDto,
  BatchS3UploadDto,
  FileQueryDto,
  FileUploadDto,
  RenameFileQueryDto,
} from './file.schema'
import { FileService } from './file.service'

@ApiController(['objects', 'files'])
export class FileController {
  private readonly logger = new Logger(FileController.name)

  constructor(
    private readonly service: FileService,
    private readonly uploadService: UploadService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly configsService: ConfigsService,
  ) {}

  @Delete('/orphans/batch')
  @Auth()
  async batchDeleteOrphans(@Body() body: BatchOrphanDeleteDto) {
    return this.fileReferenceService.batchDeleteOrphans(body)
  }

  @Post('/s3/batch-upload')
  @Auth()
  async batchUploadToS3(@Body() body: BatchS3UploadDto) {
    const config = await this.configsService.get('imageStorageOptions')

    if (!config.enable || !config.syncOnPublish) {
      return {
        results: body.urls.map((url) => ({
          originalUrl: url,
          s3Url: null,
          error: !config.enable
            ? 'S3 storage is not enabled'
            : 'Sync on publish is disabled',
        })),
      }
    }

    if (
      !config.endpoint ||
      !config.secretId ||
      !config.secretKey ||
      !config.bucket
    ) {
      return {
        results: body.urls.map((url) => ({
          originalUrl: url,
          s3Url: null,
          error: 'S3 configuration is incomplete',
        })),
      }
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

    const results = await Promise.all(
      body.urls.map(async (url) => {
        try {
          const filename = this.extractLocalImageFilename(url)
          if (!filename) {
            return {
              originalUrl: url,
              s3Url: null,
              error: 'Invalid URL format',
            }
          }

          const localPath = path.join(STATIC_FILE_DIR, 'image', filename)
          const buffer = await fs.readFile(localPath)
          const contentType = lookup(filename) || 'application/octet-stream'

          // 处理 prefix 中的模板变量
          let prefixPath = ''
          if (config.prefix) {
            prefixPath = replaceFilenameTemplate(config.prefix, {
              originalFilename: filename,
              fileType: 'image',
            })
            prefixPath = prefixPath.replace(/\/+$/, '')
          }

          const objectKey = prefixPath ? `${prefixPath}/${filename}` : filename

          const s3Url = await s3Uploader.uploadBuffer(
            buffer,
            objectKey,
            contentType,
          )

          this.logger.log(`Uploaded to S3: ${filename} -> ${s3Url}`)

          return { originalUrl: url, s3Url }
        } catch (error) {
          this.logger.error(`Failed to upload ${url}:`, error)
          return {
            originalUrl: url,
            s3Url: null,
            error: error instanceof Error ? error.message : 'Upload failed',
          }
        }
      }),
    )

    return { results }
  }

  private extractLocalImageFilename(url: string): string | null {
    const match = url.match(/\/objects\/image\/([^#/?]+)/)
    return match ? match[1] : null
  }

  @Get('/orphans/list')
  @Auth()
  async getOrphanFiles(@Query() query: PagerDto) {
    const { page = 1, size = 20 } = query
    const [files, total] = await Promise.all([
      this.fileReferenceService.model
        .find({ status: 'pending' })
        .sort({ created: -1 })
        .skip((page - 1) * size)
        .limit(size)
        .lean(),
      this.fileReferenceService.model.countDocuments({ status: 'pending' }),
    ])

    return {
      data: files.map((file) => ({
        id: file._id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        created: file.created,
      })),
      pagination: {
        currentPage: page,
        totalPage: Math.ceil(total / size),
        size,
        total,
        hasNextPage: page * size < total,
        hasPrevPage: page > 1,
      },
    }
  }

  @Get('/orphans/count')
  @Auth()
  async getOrphanFilesCount() {
    const count = await this.fileReferenceService.getOrphanFilesCount()
    return { count }
  }

  @Post('/orphans/cleanup')
  @Auth()
  async cleanupOrphanFiles(@Query('maxAgeMinutes') maxAgeMinutes?: number) {
    return this.fileReferenceService.cleanupOrphanFiles(maxAgeMinutes || 60)
  }

  @Get('/:type')
  @Auth()
  async getTypes(@Query() query: PagerDto, @Param() params: FileUploadDto) {
    const { type = 'file' } = params
    // const { page, size } = query
    const dir = await this.service.getDir(type)
    return Promise.all(
      dir.map(async (name) => {
        const { birthtime } = await fs.stat(
          path.resolve(STATIC_FILE_DIR, type, name),
        )
        return {
          name,
          url: await this.service.resolveFileUrl(type, name),
          created: +birthtime,
        }
      }),
    ).then((data) => {
      return data.sort((a, b) => b.created - a.created)
    })
  }

  @Get('/:type/:name')
  @Throttle({
    default: {
      limit: 60,
      ttl: 60_000,
    },
  })
  @HTTPDecorators.Bypass
  async get(@Param() params: FileQueryDto, @Res() reply: FastifyReply) {
    const { type, name } = params
    const ext = path.extname(name)
    const mimetype = lookup(ext)

    try {
      const stream = await this.service.getFileStream(type, name)
      if (mimetype) {
        reply.type(mimetype)
        reply.header('cache-control', 'public, max-age=31536000')
        reply.header(
          'expires',
          new Date(Date.now() + 31536000 * 1000).toUTCString(),
        )
      }

      return reply.send(stream)
    } catch {
      throw new CannotFindException()
    }
  }

  @Post('/upload')
  @Auth()
  async upload(@Query() query: FileUploadDto, @Req() req: FastifyRequest) {
    const file = await this.uploadService.getAndValidMultipartField(req)
    const { type = 'file' } = query

    // 获取文件上传配置
    const uploadConfig = await this.configsService.get('fileUploadOptions')

    // 生成文件名（可能包含子路径）
    const rawFilename = generateFilename(uploadConfig, {
      originalFilename: file.filename,
      fileType: type,
    })

    // 生成基础路径
    const basePath = generateFilePath(uploadConfig, {
      originalFilename: file.filename,
      fileType: type,
    })

    // 构建相对路径（相对于文件类型目录）
    // 如果 basePath 就是 type，则直接使用 rawFilename
    // 否则，将 basePath 中除去 type 部分后与 rawFilename 合并
    let relativePath: string
    if (basePath === type || !basePath) {
      // basePath 就是 type 或为空，直接使用 rawFilename
      relativePath = rawFilename
    } else {
      // basePath 包含自定义路径，需要去除开头的 type 部分
      const pathWithoutType = basePath.startsWith(`${type}/`)
        ? basePath.slice(Math.max(0, type.length + 1))
        : basePath
      relativePath = path.join(pathWithoutType, rawFilename)
    }

    await this.service.writeFile(type, relativePath, file.file)

    const fileUrl = await this.service.resolveFileUrl(type, relativePath)

    if (type === 'image') {
      await this.fileReferenceService.createPendingReference(
        fileUrl,
        relativePath,
      )
    }

    return {
      url: fileUrl,
      name: path.basename(relativePath),
    }
  }

  @Delete('/:type/:name')
  @Auth()
  async delete(@Param() params: FileQueryDto) {
    const { type, name } = params
    await this.service.deleteFile(type, name)
  }

  @Auth()
  @Patch('/:type/:name/rename')
  async rename(
    @Param() params: FileQueryDto,
    @Query() query: RenameFileQueryDto,
  ) {
    const { type, name } = params
    const { new_name } = query
    await this.service.renameFile(type, name, new_name)
  }
}
