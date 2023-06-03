import { Readable } from 'stream'
import { FastifyRequest } from 'fastify'

import {
  BadRequestException,
  Body,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BanInDemo } from '~/common/decorators/demo.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { getMediumDateTime } from '~/utils'

import { BackupService } from './backup.service'

@ApiController({ path: 'backups' })
@Auth()
@BanInDemo
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('/new')
  @Header(
    'Content-Disposition',
    `attachment; filename="backup-${getMediumDateTime(new Date())}.zip"`,
  )
  @Header('Content-Type', 'application/zip')
  @HTTPDecorators.Bypass
  async createNewBackup() {
    const res = await this.backupService.backup()
    if (typeof res == 'undefined' || typeof res.buffer === 'undefined') {
      throw new BadRequestException('请先开启在设置开启备份功能')
    }
    const stream = new Readable()

    stream.push(res.buffer)
    stream.push(null)
    return stream
  }

  @Get('/')
  async get() {
    return this.backupService.list()
  }

  @HTTPDecorators.Bypass
  @Header('Content-Type', 'application/zip')
  @Get('/:dirname')
  async download(@Param('dirname') dirname: string) {
    return this.backupService.getFileStream(dirname)
  }

  @Post(['/rollback/', '/'])
  async uploadAndRestore(@Req() req: FastifyRequest) {
    const data = await this.uploadService.getAndValidMultipartField(req)
    const { mimetype } = data
    if (mimetype !== 'application/zip') {
      throw new UnprocessableEntityException('备份格式必须为 application/zip')
    }

    await this.backupService.saveTempBackupByUpload(await data.toBuffer())

    return
  }
  @Patch(['/rollback/:dirname', '/:dirname'])
  async rollback(@Param('dirname') dirname: string) {
    if (!dirname) {
      throw new UnprocessableEntityException('参数有误')
    }

    this.backupService.rollbackTo(dirname)
    return
  }

  @Delete('/')
  async deleteBackups(
    @Query('files') files: string,
    @Body('files') filesBody: string,
  ) {
    const nextFiles = files || filesBody
    if (!nextFiles) {
      throw new UnprocessableEntityException('参数有误')
    }

    const filesList = nextFiles.split(',')

    await Promise.all(filesList.map((f) => this.backupService.deleteBackup(f)))
    return
  }

  @Delete('/:filename')
  async delete(@Param('filename') filename: string) {
    if (!filename) {
      return
    }
    await this.backupService.deleteBackup(filename)
    return
  }
}
