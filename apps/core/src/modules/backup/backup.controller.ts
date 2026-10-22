import path from 'node:path'
import { Readable } from 'node:stream'

import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import type { UploadedMultipartFile } from '@nestjs/platform-fastify'
import type { FastifyReply } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { requiredFilePipe } from '~/common/pipes/required-file.pipe'

import { BackupService } from './backup.service'
import { BackupUploadInterceptor, RestoreKeySchema } from './backup-restore'

@ApiController({ path: 'backups' })
@Auth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('/new')
  @HTTPDecorators.RawResponse
  async createNewBackup(@Res({ passthrough: true }) reply: FastifyReply) {
    const res = await this.backupService.backup()
    if (typeof res == 'undefined') {
      throw createAppException(AppErrorCode.BACKUP_NOT_ENABLED)
    }
    if (typeof res.buffer === 'undefined') {
      throw createAppException(AppErrorCode.FILE_NOT_FOUND, {
        extra: 'backup missing',
      })
    }
    reply.type(
      res.path.endsWith('.zip')
        ? 'application/zip'
        : 'application/octet-stream',
    )
    reply.header(
      'Content-Disposition',
      `attachment; filename="${path.basename(res.path)}"`,
    )
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
  @Get('/:dirname')
  async download(
    @Param('dirname') dirname: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const stream = await this.backupService.getFileStream(dirname)
    const legacy = String(stream.path).endsWith('.zip')
    reply.type(legacy ? 'application/zip' : 'application/octet-stream')
    reply.header(
      'Content-Disposition',
      `attachment; filename="backup-${dirname}.${legacy ? 'zip' : 'mxbackup'}"`,
    )
    return stream
  }

  @Post(['/rollback/', '/'])
  @HttpCode(200)
  @UseInterceptors(BackupUploadInterceptor)
  async uploadAndRestore(
    @UploadedFile(requiredFilePipe) data: UploadedMultipartFile,
    @Body('decryptionKey') decryptionKey?: string,
  ) {
    await this.backupService.saveTempBackupByUpload(
      data.buffer!,
      RestoreKeySchema.parse(decryptionKey),
    )
  }
  @Patch(['/rollback/:dirname', '/:dirname'])
  async rollback(
    @Param('dirname') dirname: string,
    @Body('decryptionKey') decryptionKey?: string,
  ) {
    if (!dirname) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'dirname is required',
      })
    }

    await this.backupService.rollbackTo(
      dirname,
      RestoreKeySchema.parse(decryptionKey),
    )
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
    await this.backupService.backupDB()
  }
}
