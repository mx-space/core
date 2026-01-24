import fs from 'node:fs/promises'
import path from 'node:path'
import {
  Delete,
  Get,
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
import { alphabet } from '~/constants/other.constant'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { PagerDto } from '~/shared/dto/pager.dto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'
import { customAlphabet } from 'nanoid'
import { FileReferenceService } from './file-reference.service'
import { FileQueryDto, FileUploadDto, RenameFileQueryDto } from './file.schema'
import { FileService } from './file.service'

@ApiController(['objects', 'files'])
export class FileController {
  constructor(
    private readonly service: FileService,
    private readonly uploadService: UploadService,
    private readonly fileReferenceService: FileReferenceService,
  ) {}

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
    const result = await this.fileReferenceService.cleanupOrphanFiles(
      maxAgeMinutes || 60,
    )
    return result
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

    const ext = path.extname(file.filename)
    const filename = customAlphabet(alphabet)(18) + ext.toLowerCase()

    await this.service.writeFile(type, filename, file.file)

    const fileUrl = await this.service.resolveFileUrl(type, filename)

    if (type === 'image') {
      await this.fileReferenceService.createPendingReference(fileUrl, filename)
    }

    return {
      url: fileUrl,
      name: filename,
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
