import { Readable } from 'node:stream'

import {
  Body,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import type { UploadedMultipartFile } from '@nestjs/platform-fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { ZipUploadInterceptor } from '~/common/interceptors/zip-upload.interceptor'
import { requiredFilePipe } from '~/common/pipes/required-file.pipe'
import { getMediumDateTime } from '~/utils/time.util'

import { BackupService } from './backup.service'

@ApiController({ path: 'backups' })
@Auth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('/new')
  @HTTPDecorators.RawResponse
  @Header(
    'Content-Disposition',
    `attachment; filename="backup-${getMediumDateTime(new Date())}.zip"`,
  )
  @Header('Content-Type', 'application/zip')
  async createNewBackup() {
    const res = await this.backupService.backup()
    if (typeof res == 'undefined') {
      throw createAppException(AppErrorCode.BACKUP_NOT_ENABLED)
    }
    if (typeof res.buffer === 'undefined') {
      throw createAppException(AppErrorCode.FILE_NOT_FOUND, {
        extra: 'backup zip missing',
      })
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

  @HTTPDecorators.RawResponse
  @Header('Content-Type', 'application/zip')
  @Get('/:dirname')
  async download(@Param('dirname') dirname: string) {
    return this.backupService.getFileStream(dirname)
  }

  @Post(['/rollback/', '/'])
  @HttpCode(200)
  @UseInterceptors(
    ZipUploadInterceptor((got) =>
      createAppException(AppErrorCode.MIME_ZIP_REQUIRED, { got }),
    ),
  )
  async uploadAndRestore(
    @UploadedFile(requiredFilePipe) data: UploadedMultipartFile,
  ) {
    await this.backupService.saveTempBackupByUpload(data.buffer!)
  }
  @Patch(['/rollback/:dirname', '/:dirname'])
  async rollback(@Param('dirname') dirname: string) {
    if (!dirname) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'dirname is required',
      })
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
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'files is required',
      })
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
  @HttpCode(200)
  async backupAndUploadToS3() {
    this.backupService.backupDB()
  }
}
