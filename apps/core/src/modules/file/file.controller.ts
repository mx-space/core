import fs from 'node:fs/promises'
import path from 'node:path'
import { FastifyReply, FastifyRequest } from 'fastify'
import { lookup } from 'mime-types'

import { nanoid } from '@mx-space/compiled'
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
import { BanInDemo } from '~/common/decorators/demo.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { alphabet } from '~/constants/other.constant'
import { STATIC_FILE_DIR } from '~/constants/path.constant'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { PagerDto } from '~/shared/dto/pager.dto'

import { FileQueryDto, FileUploadDto, RenameFileQueryDto } from './file.dto'
import { FileService } from './file.service'

const { customAlphabet } = nanoid

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
  @BanInDemo
  async upload(@Query() query: FileUploadDto, @Req() req: FastifyRequest) {
    const file = await this.uploadService.getAndValidMultipartField(req)
    const { type = 'file' } = query

    const ext = path.extname(file.filename)
    const filename = customAlphabet(alphabet)(18) + ext.toLowerCase()

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

  @Auth()
  @BanInDemo
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
