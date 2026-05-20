import { Readable } from 'node:stream'

import {
  Body,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { isZipMinetype } from '~/utils/mine.util'
import { getMediumDateTime } from '~/utils/time.util'

import { BackupService } from './backup.service'

@ApiController({ path: 'backups' })
@Auth()
@ResponseV2()
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('/new')
  @RawResponse
  @Header(
    'Content-Disposition',
    `attachment; filename="backup-${getMediumDateTime(new Date())}.zip"`,
  )
  @Header('Content-Type', 'application/zip')
  async createNewBackup() {
    const res = await this.backupService.backup()
    if (typeof res == 'undefined') {
      throw new BizException(ErrorCodeEnum.BackupNotEnabled)
    }
    if (typeof res.buffer === 'undefined') {
      throw new BizException(ErrorCodeEnum.FileNotFound, 'backup zip missing')
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

  @RawResponse
  @Header('Content-Type', 'application/zip')
  @Get('/:dirname')
  async download(@Param('dirname') dirname: string) {
    return this.backupService.getFileStream(dirname)
  }

  @Post(['/rollback/', '/'])
  async uploadAndRestore(@Req() req: FastifyRequest) {
    const data = await this.uploadService.getAndValidMultipartField(req, {
      maxFileSize: 1024 * 1024 * 100,
    })
    const { mimetype } = data

    if (!isZipMinetype(mimetype)) {
      throw new BizException(ErrorCodeEnum.MineZip, `got: ${mimetype}`)
    }

    await this.backupService.saveTempBackupByUpload(await data.toBuffer())
  }
  @Patch(['/rollback/:dirname', '/:dirname'])
  async rollback(@Param('dirname') dirname: string) {
    if (!dirname) {
      throw new BizException(ErrorCodeEnum.InvalidParameter)
    }

    this.backupService.rollbackTo(dirname)
  }

  @Delete('/')
  async deleteBackups(
    @Query('files') files: string,
    @Body('files') filesBody: string,
  ) {
    const nextFiles = files || filesBody
    if (!nextFiles) {
      throw new BizException(ErrorCodeEnum.InvalidParameter)
    }

    const filesList = nextFiles.split(',')

    await Promise.all(filesList.map((f) => this.backupService.deleteBackup(f)))
  }

  @Delete('/:filename')
  async delete(@Param('filename') filename: string) {
    if (!filename) {
      return
    }
    await this.backupService.deleteBackup(filename)
  }

  @Post('/upload-to-s3')
  async backupAndUploadToS3() {
    this.backupService.backupDB()
  }
}
