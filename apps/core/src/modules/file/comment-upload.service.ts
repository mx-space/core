import { Readable } from 'node:stream'

import { Injectable, Logger } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { InjectModel } from '~/transformers/model.transformer'
import {
  generateFilename,
  replaceFilenameTemplate,
} from '~/utils/filename-template.util'
import { S3Uploader } from '~/utils/s3.util'

import { FileService } from './file.service'
import {
  FileReferenceModel,
  FileReferenceStatus,
  FileUploadedBy,
} from './file-reference.model'

const DEFAULT_COMMENT_UPLOAD_PREFIX_TEMPLATE = 'comments/{readerId}/{Y}/{m}'

const DEFAULT_MIME_WHITELIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export interface ReaderUploadResult {
  url: string
  fileName: string
  byteSize: number
  mimeType: string
  expireAt: string
}

export interface PublicCommentUploadConfig {
  enable: boolean
  singleFileSizeMB: number
  commentImageMaxCount: number
  mimeWhitelist: string[]
  pendingTtlMinutes: number
}

/**
 * 通过 file-type 库识别 buffer 真型，避免攻击者借扩展名上传非图片内容。
 */
async function detectImageMime(
  buffer: Buffer,
): Promise<{ mime: string; ext: string } | null> {
  const result = await fileTypeFromBuffer(buffer)
  if (!result) return null
  return { mime: result.mime, ext: `.${result.ext}` }
}

@Injectable()
export class CommentUploadService {
  private readonly logger = new Logger(CommentUploadService.name)

  constructor(
    @InjectModel(FileReferenceModel)
    private readonly fileReferenceModel: MongooseModel<FileReferenceModel>,
    private readonly configsService: ConfigsService,
    private readonly uploadService: UploadService,
    private readonly fileService: FileService,
  ) {}

  async getPublicConfig(): Promise<PublicCommentUploadConfig> {
    const config = await this.configsService.get('commentUploadOptions')
    return {
      enable: config.enable ?? true,
      singleFileSizeMB: config.singleFileSizeMB ?? 5,
      commentImageMaxCount: config.commentImageMaxCount ?? 4,
      mimeWhitelist: config.mimeWhitelist?.length
        ? config.mimeWhitelist
        : DEFAULT_MIME_WHITELIST,
      pendingTtlMinutes: config.pendingTtlMinutes ?? 120,
    }
  }

  async uploadForReader(
    req: FastifyRequest,
    readerId: string,
  ): Promise<ReaderUploadResult> {
    const config = await this.configsService.get('commentUploadOptions')
    if (config.enable === false) {
      throw new BizException(ErrorCodeEnum.CommentUploadDisabled)
    }

    const singleFileSizeMB = config.singleFileSizeMB ?? 5
    const maxFileSize = singleFileSizeMB * 1024 * 1024
    const whitelist = config.mimeWhitelist?.length
      ? config.mimeWhitelist
      : DEFAULT_MIME_WHITELIST
    const pendingTtlMinutes = config.pendingTtlMinutes ?? 120

    const file = await this.uploadService.getAndValidMultipartField(req, {
      maxFileSize,
    })

    const chunks: Buffer[] = []
    let totalBytes = 0
    for await (const chunk of file.file) {
      chunks.push(chunk)
      totalBytes += chunk.length
      if (totalBytes > maxFileSize) {
        throw new BizException(ErrorCodeEnum.CommentUploadFileTooLarge)
      }
    }
    const buffer = Buffer.concat(chunks)

    if (file.file.truncated) {
      throw new BizException(ErrorCodeEnum.CommentUploadFileTooLarge)
    }

    const detected = await detectImageMime(buffer)
    if (!detected || !whitelist.includes(detected.mime)) {
      throw new BizException(ErrorCodeEnum.CommentUploadInvalidMime)
    }

    const detectedMime = detected.mime
    const ext = detected.ext
    const originalFilename = `upload${ext}`
    const fileUploadConfig = await this.configsService.get('fileUploadOptions')
    const filename = generateFilename(fileUploadConfig, {
      originalFilename,
      fileType: 'image',
      readerId,
    })

    const imageStorageConfig = await this.configsService.get(
      'imageStorageOptions',
    )

    const useS3 =
      imageStorageConfig?.enable &&
      !!imageStorageConfig.endpoint &&
      !!imageStorageConfig.secretId &&
      !!imageStorageConfig.secretKey &&
      !!imageStorageConfig.bucket

    const prefixTemplate =
      imageStorageConfig?.commentUploadPrefix ||
      DEFAULT_COMMENT_UPLOAD_PREFIX_TEMPLATE

    const renderedPath = replaceFilenameTemplate(prefixTemplate, {
      originalFilename,
      fileType: 'image',
      readerId,
    }).replace(/\/+$/, '')

    const objectKey = renderedPath ? `${renderedPath}/${filename}` : filename

    let url: string
    let s3ObjectKey: string | undefined

    if (useS3) {
      const s3Uploader = new S3Uploader({
        endpoint: imageStorageConfig.endpoint!,
        accessKey: imageStorageConfig.secretId!,
        secretKey: imageStorageConfig.secretKey!,
        bucket: imageStorageConfig.bucket!,
        region: imageStorageConfig.region || 'auto',
      })
      if (imageStorageConfig.customDomain) {
        s3Uploader.setCustomDomain(imageStorageConfig.customDomain)
      }
      try {
        url = await s3Uploader.uploadBuffer(buffer, objectKey, detectedMime)
      } catch (err) {
        this.logger.error(
          `S3 upload failed endpoint=${imageStorageConfig.endpoint} bucket=${imageStorageConfig.bucket} region=${imageStorageConfig.region || 'auto'} objectKey=${objectKey} contentType=${detectedMime} byteSize=${totalBytes}: ${err instanceof Error ? err.message : String(err)}`,
        )
        throw err
      }
      s3ObjectKey = objectKey
    } else {
      const relativePath = objectKey
      await this.fileService.writeFile(
        'image' as never,
        relativePath,
        Readable.from(buffer),
      )
      url = await this.fileService.resolveFileUrl(
        'image' as never,
        relativePath,
      )
    }

    const fileName = s3ObjectKey ?? objectKey

    await this.fileReferenceModel.create({
      fileUrl: url,
      fileName,
      status: FileReferenceStatus.Pending,
      readerId,
      uploadedBy: FileUploadedBy.Reader,
      mimeType: detectedMime,
      byteSize: totalBytes,
      ...(s3ObjectKey && { s3ObjectKey }),
    })

    const expireAt = new Date(
      Date.now() + pendingTtlMinutes * 60 * 1000,
    ).toISOString()

    return {
      url,
      fileName,
      byteSize: totalBytes,
      mimeType: detectedMime,
      expireAt,
    }
  }
}
