import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Scope,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger'
import dayjs from 'dayjs'
import { FastifyRequest } from 'fastify'
import { Readable } from 'stream'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CronService } from '~/processors/helper/helper.cron.service'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { BackupService } from './backup.service'

@Controller({ path: 'backups', scope: Scope.REQUEST })
@ApiName
@Auth()
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly uploadService: UploadService,
    private readonly cronService: CronService,
  ) {}

  @Get('/new')
  @ApiResponseProperty({ type: 'string', format: 'binary' })
  @Header(
    'Content-Disposition',
    `attachment; filename="backup-${dayjs().format('DD/MM/YYYY')}.zip"`,
  )
  @Header('Content-Type', 'application/zip')
  @HTTPDecorators.Bypass
  async createNewBackup() {
    const buffer = await this.cronService.backupDB({ uploadCOS: false })
    const stream = new Readable()

    stream.push(buffer)
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
  @ApiProperty({ description: '上传备份恢复' })
  @HTTPDecorators.FileUpload({ description: 'Upload backup and restore' })
  async uploadAndRestore(@Req() req: FastifyRequest) {
    const data = await this.uploadService.validMultipartField(req)
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
  async deleteBackups(@Query('files') files: string) {
    if (!files) {
      return
    }
    const _files = files.split(',')
    for await (const f of _files) {
      await this.backupService.deleteBackup(f)
    }
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
