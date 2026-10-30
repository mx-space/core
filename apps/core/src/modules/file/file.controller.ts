import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import type { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { MediaProcessingService } from '~/processors/helper/helper.media-processing.service'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { type BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'
import {
  generateFilename,
  generateFilePath,
  replaceFilenameTemplate,
} from '~/utils/filename-template.util'
import { S3Uploader } from '~/utils/s3.util'
import { resolveUniqueObjectKey } from '~/utils/unique-object-key.util'

import {
  type BatchOrphanDeleteDto,
  BatchOrphanDeleteSchema,
  type CommentUploadsListQueryDto,
  CommentUploadsListQuerySchema,
  type FileQueryDto,
  FileQuerySchema,
  type FileUploadDto,
  FileUploadSchema,
  type ReconcileFileReferencesDto,
  ReconcileFileReferencesSchema,
  type RenameFileQueryDto,
  RenameFileQuerySchema,
} from './file.schema'
import { FileService } from './file.service'
import { FileReferenceService } from './file-reference.service'
import { FileDeletionReason } from './file-reference.types'
import { FileReferenceReconciliationService } from './file-reference-reconciliation.service'

@ApiController(['objects', 'files'])
export class FileController {
  constructor(
    private readonly service: FileService,
    private readonly uploadService: UploadService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly fileReferenceReconciliationService: FileReferenceReconciliationService,
    private readonly configsService: ConfigsService,
    private readonly mediaProcessingService: MediaProcessingService,
  ) {}

  @Post('/references/reconcile')
  @HttpCode(200)
  @Auth()
  async reconcileFileReferences(
    @Body({ schema: ReconcileFileReferencesSchema })
    body: ReconcileFileReferencesDto,
  ) {
    return this.fileReferenceReconciliationService.reconcile(body)
  }

  @Delete('/orphans/batch')
  @Auth()
  async batchDeleteOrphans(
    @Body({ schema: BatchOrphanDeleteSchema }) body: BatchOrphanDeleteDto,
  ) {
    return this.fileReferenceService.batchDeleteOrphans(body)
  }

  @Get('/orphans/list')
  @Auth()
  async getOrphanFiles(
    @Query({ schema: BasicPagerSchema }) query: BasicPagerDto,
  ) {
    const { page = 1, size = 20 } = query
    const { data: files, pagination } =
      await this.fileReferenceService.listOrphanFiles(page, size)

    return withMeta(
      files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        status: file.status,
        uploadedBy: file.uploadedBy,
        readerId: file.readerId,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        refType: file.refType,
        refId: file.refId,
        detachedAt: file.detachedAt,
        createdAt: file.createdAt,
      })),
      new MetaObjectBuilder().pagination(pagination).build(),
    )
  }

  @Get('/remote/list')
  @Auth()
  async getRemoteFiles(
    @Query({ schema: BasicPagerSchema }) query: BasicPagerDto,
  ) {
    const { page = 1, size = 20 } = query
    const { data: files, pagination } =
      await this.fileReferenceService.listRemoteFiles(page, size)

    return withMeta(
      files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        objectKey: file.s3ObjectKey,
        status: file.status,
        inUse: file.inUse,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        createdAt: file.createdAt,
      })),
      new MetaObjectBuilder().pagination(pagination).build(),
    )
  }

  @Delete('/remote/:id')
  @Auth()
  async deleteRemoteFile(@Param('id') id: string) {
    await this.fileReferenceService.deleteRemoteFile(id)
  }

  @Get('/orphans/count')
  @Auth()
  async getOrphanFilesCount() {
    const count = await this.fileReferenceService.getOrphanFilesCount()
    return { count }
  }

  @Post('/orphans/cleanup')
  @HttpCode(200)
  @Auth()
  async cleanupOrphanFiles(@Query('maxAgeMinutes') maxAgeMinutes?: number) {
    return this.fileReferenceService.cleanupOrphanFiles(maxAgeMinutes || 60)
  }

  @Get('/comment-uploads/list')
  @Auth()
  async getCommentUploads(
    @Query({ schema: CommentUploadsListQuerySchema })
    query: CommentUploadsListQueryDto,
  ) {
    const { page, size, status, readerId, refId } = query
    const { files, total } = await this.fileReferenceService.listReaderUploads({
      page,
      size,
      status,
      readerId,
      refId,
    })

    return withMeta(
      files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        status: file.status,
        readerId: file.readerId,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        refType: file.refType,
        refId: file.refId,
        detachedAt: file.detachedAt,
        createdAt: file.createdAt,
      })),
      new MetaObjectBuilder()
        .pagination({
          page,
          size,
          total,
          totalPages: Math.ceil(total / size),
        })
        .build(),
    )
  }

  @Delete('/comment-uploads/:id')
  @Auth()
  async deleteCommentUpload(@Param('id') id: string) {
    const file = await this.fileReferenceService.getReferenceById(id)
    if (!file) {
      throw createAppException(AppErrorCode.FILE_NOT_FOUND, { name: id })
    }
    const { storageRemoved } = await this.fileReferenceService.hardDeleteFile(
      file,
      FileDeletionReason.Manual,
    )
    return { storageRemoved }
  }

  @Get('/:type')
  @Auth()
  async getTypes(
    @Query({ schema: BasicPagerSchema }) query: BasicPagerDto,
    @Param({ schema: FileUploadSchema }) params: FileUploadDto,
  ) {
    const { type = 'file' } = params
    const dir = await this.service.getDir(type)
    const files = await Promise.all(
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
    )
    return files.sort((a, b) => b.created - a.created)
  }

  @Get('/:type/*')
  @Throttle({
    default: {
      limit: 60,
      ttl: 60_000,
    },
  })
  @HTTPDecorators.RawResponse
  async get(
    @Param('type') routeType: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const wildcardName = decodeURIComponent(
      (req.params as Record<string, string>)['*'],
    )
    const params = FileQuerySchema.parse({
      type: routeType,
      name: wildcardName,
    })
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
      throw createAppException(AppErrorCode.FILE_NOT_FOUND, { name })
    }
  }

  @Post('/upload')
  @Auth()
  async upload(
    @Query({ schema: FileUploadSchema }) query: FileUploadDto,
    @Req() req: FastifyRequest,
  ) {
    const { type = 'file' } = query
    const raw = query.raw === 'true'

    const uploadConfig = await this.configsService.get('fileUploadOptions')
    const imageStorageConfig = await this.configsService.get(
      'imageStorageOptions',
    )
    const s3Enabled = imageStorageConfig?.enable === true

    if (type === 'video') {
      return this.uploadVideo(
        req,
        uploadConfig,
        s3Enabled ? imageStorageConfig : null,
        raw,
      )
    }

    const isS3Routed = s3Enabled && (type === 'image' || type === 'file')
    const maxFileSize =
      type === 'image' || isS3Routed ? 20 * 1024 * 1024 : undefined

    const file = await this.uploadService.getAndValidMultipartField(
      req,
      maxFileSize === undefined ? undefined : { maxFileSize },
    )

    const chunks: Buffer[] = []
    for await (const chunk of file.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    if (!isS3Routed && file.file.truncated) {
      throw createAppException(AppErrorCode.FILE_TOO_LARGE)
    }

    const processed =
      type === 'image' && !raw
        ? await this.mediaProcessingService.processImage(buffer, file.filename)
        : null
    const filename = processed?.filename ?? file.filename
    const contentType =
      processed?.contentType ??
      (lookup(file.filename) || 'application/octet-stream')

    return this.service.uploadBuffer(processed?.buffer ?? buffer, {
      type,
      originalFilename: filename,
      contentType,
      objectKey: query.immutable
        ? `versions/${randomUUID()}${path.extname(filename)}`
        : undefined,
    })
  }

  private async uploadVideo(
    req: FastifyRequest,
    uploadConfig: IConfig['fileUploadOptions'],
    s3Config: IConfig['imageStorageOptions'] | null,
    raw: boolean,
  ) {
    const type = 'video'
    const transcode =
      !raw && (await this.mediaProcessingService.isVideoTranscodeEnabled())
    const videoMaxSize = (uploadConfig.videoMaxSize ?? 100) * 1024 * 1024

    if (s3Config) {
      const config = s3Config
      if (
        !config.endpoint ||
        !config.secretId ||
        !config.secretKey ||
        !config.bucket
      ) {
        throw createAppException(AppErrorCode.FILE_STORAGE_NOT_CONFIGURED)
      }

      const file = await this.uploadService.getAndValidMultipartField(req, {
        maxFileSize: transcode ? videoMaxSize : Number.MAX_SAFE_INTEGER,
      })
      const video = transcode
        ? await this.mediaProcessingService.transcodeVideo(
            file.file,
            file.filename,
          )
        : null

      try {
        const originalFilename = video?.filename ?? file.filename
        let filename = generateFilename(uploadConfig, {
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

        const objectKey = await resolveUniqueObjectKey(
          prefixPath ? `${prefixPath}/${filename}` : filename,
          (key) => s3Uploader.objectExists(key),
        )
        filename = path.posix.basename(objectKey)

        const contentType =
          video?.contentType ??
          (lookup(file.filename) || 'application/octet-stream')
        const s3Url = await s3Uploader.uploadStream(
          video ? createReadStream(video.path) : file.file,
          objectKey,
          contentType,
        )

        await this.fileReferenceService.createPendingReference(
          s3Url,
          filename,
          objectKey,
        )

        return { url: s3Url, name: filename }
      } finally {
        await video?.cleanup()
      }
    }

    const file = await this.uploadService.getAndValidMultipartField(req, {
      maxFileSize: videoMaxSize,
    })
    const video = transcode
      ? await this.mediaProcessingService.transcodeVideo(
          file.file,
          file.filename,
        )
      : null

    try {
      const originalFilename = video?.filename ?? file.filename
      const rawFilename = generateFilename(uploadConfig, {
        originalFilename,
        fileType: type,
      })

      const basePath = generateFilePath(uploadConfig, {
        originalFilename,
        fileType: type,
      })

      let relativePath: string
      if (basePath === type || !basePath) {
        relativePath = rawFilename
      } else {
        const pathWithoutType = basePath.startsWith(`${type}/`)
          ? basePath.slice(Math.max(0, type.length + 1))
          : basePath
        relativePath = path.join(pathWithoutType, rawFilename)
      }
      relativePath = await this.service.resolveUniqueLocalName(
        type,
        relativePath,
      )

      await this.service.writeFile(
        type,
        relativePath,
        video ? createReadStream(video.path) : file.file,
      )
      if (file.file.truncated) {
        await this.service.deleteFile(type, relativePath).catch(() => void 0)
        throw createAppException(AppErrorCode.FILE_TOO_LARGE)
      }
      const fileUrl = await this.service.resolveFileUrl(type, relativePath)
      await this.fileReferenceService.createPendingReference(
        fileUrl,
        relativePath,
      )

      return { url: fileUrl, name: path.basename(relativePath) }
    } finally {
      await video?.cleanup()
    }
  }

  @Delete('/:type/:name')
  @Auth()
  async delete(@Param({ schema: FileQuerySchema }) params: FileQueryDto) {
    const { type, name } = params
    await this.service.deleteFile(type, name)
  }

  @Auth()
  @Patch('/:type/:name/rename')
  async rename(
    @Param({ schema: FileQuerySchema }) params: FileQueryDto,
    @Query({ schema: RenameFileQuerySchema }) query: RenameFileQueryDto,
  ) {
    const { type, name } = params
    const { newName } = query
    await this.service.renameFile(type, name, newName)
  }
}
