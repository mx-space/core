import { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'
import { customAlphabet } from 'nanoid/async'

import { Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { BanInDemo } from '~/common/decorator/demo.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { alphabet } from '~/constants/other.constant'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { PagerDto } from '~/shared/dto/pager.dto'

import { FileQueryDto, FileUploadDto } from './file.dto'
import { FileService } from './file.service'

@ApiName
@ApiController(['objects', 'files'])
export class FileController {
  constructor(
    private readonly service: FileService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('/:type')
  @Auth()
  async getTypes(@Query() query: PagerDto, @Param() params: FileUploadDto) {
    const { type = 'file' } = params
    // const { page, size } = query
    const dir = await this.service.getDir(type)
    return Promise.all(
      dir.map(async (name) => {
        return { name, url: await this.service.resolveFileUrl(type, name) }
      }),
    )
  }

  @Get('/:type/:name')
  @Throttle(60, 60)
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

  @HTTPDecorators.FileUpload({ description: 'upload file' })
  @Post('/upload')
  @Auth()
  @BanInDemo
  async upload(@Query() query: FileUploadDto, @Req() req: FastifyRequest) {
    const file = await this.uploadService.getAndValidMultipartField(req)
    const { type = 'file' } = query

    const ext = path.extname(file.filename)
    const filename = (await customAlphabet(alphabet)(18)) + ext.toLowerCase()

    await this.service.writeFile(type, filename, file.file)

    return {
      url: await this.service.resolveFileUrl(type, filename),
      name: filename,
    }
  }

  @Delete('/:type/:name')
  @Auth()
  @BanInDemo
  async delete(@Param() params: FileQueryDto) {
    const { type, name } = params
    await this.service.deleteFile(type, name)
  }
}
