import { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'

import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'

import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { PagerDto } from '~/shared/dto/pager.dto'
import { md5 } from '~/utils'

import { FileQueryDto, FileUploadDto } from './file.dto'
import { FileService } from './file.service'

@ApiName
@Controller(['objects', 'files'])
export class FileController {
  constructor(
    private readonly service: FileService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('/:type')
  @Auth()
  async getTypes(@Query() query: PagerDto, @Param() params: FileUploadDto) {
    const { type = 'file' } = params
    const { page, size } = query
    const dir = await this.service.getDir(type)
    return Promise.all(
      dir.map(async (name) => {
        return { name, url: await this.service.resolveFileUrl(type, name) }
      }),
    )
  }

  @Get('/:type/:name')
  @HTTPDecorators.Bypass
  async get(@Param() params: FileQueryDto, @Res() reply: FastifyReply) {
    const { type, name } = params
    const ext = path.extname(name)
    const mimetype = lookup(ext)

    try {
      const buffer = await this.service.getFile(type, name)
      if (mimetype) {
        reply.type(mimetype)
      }

      reply.send(buffer)
    } catch {
      throw new CannotFindException()
    }
  }

  @HTTPDecorators.FileUpload({ description: 'upload file' })
  @Post('/upload')
  @Auth()
  async upload(@Query() query: FileUploadDto, @Req() req: FastifyRequest) {
    const file = await this.uploadService.getAndValidMultipartField(req)
    const { type = 'file' } = query

    const ext = path.extname(file.filename)
    const filename = md5(file.filename) + ext

    await this.service.writeFile(type, filename, file.file)

    return {
      path: await this.service.resolveFileUrl(type, filename),
    }
  }

  @Delete('/:type/:name')
  @Auth()
  async delete(@Param() params: FileQueryDto) {
    const { type, name } = params
    await this.service.deleteFile(type, name)
  }
}
