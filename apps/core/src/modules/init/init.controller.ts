import { Body, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { isZipMinetype } from '~/utils/mine.util'

import { BackupService } from '../backup/backup.service'
import { ConfigsService } from '../configs/configs.service'
import { ConfigKeyDto } from '../option/option.schema'
import { InitGuard } from './init.guard'
import { InitOwnerCreateDto } from './init.schema'
import { InitService } from './init.service'

@ApiController('/init')
@UseGuards(InitGuard)
export class InitController {
  constructor(
    private readonly configs: ConfigsService,
    private readonly initService: InitService,
    private readonly backupService: BackupService,
    private readonly uploadService: UploadService,
  ) {}

  private async assertNotInitialized(forbiddenMode = false) {
    if (await this.initService.isInit()) {
      if (forbiddenMode) {
        throw createAppException(AppErrorCode.INIT_FORBIDDEN)
      }
      throw createAppException(AppErrorCode.INIT_ALREADY_COMPLETED)
    }
  }

  @Get('/')
  async isInit() {
    return {
      isInit: await this.initService.isInit(),
    }
  }

  @Get('/configs/default')
  async getDefaultConfig() {
    await this.assertNotInitialized(true)
    return this.configs.defaultConfig
  }

  @Patch('/configs/:key')
  async patch(
    @Param() params: ConfigKeyDto,
    @Body() body: Record<string, any>,
  ) {
    await this.assertNotInitialized()
    if (typeof body !== 'object') {
      throw createAppException(AppErrorCode.INIT_INVALID_BODY)
    }
    return this.configs.patchAndValid(params.key, body)
  }

  @Post('/owner')
  async createOwner(@Body() body: InitOwnerCreateDto) {
    await this.assertNotInitialized()
    return this.initService.createOwner(body)
  }

  @Post('/restore')
  async uploadAndRestore(@Req() req: FastifyRequest) {
    const data = await this.uploadService.getAndValidMultipartField(req, {
      maxFileSize: 1024 * 1024 * 100,
    })
    const { mimetype } = data
    if (!isZipMinetype(mimetype)) {
      throw createAppException(AppErrorCode.INIT_INVALID_MIME_TYPE, {
        got: mimetype,
      })
    }

    await this.backupService.saveTempBackupByUpload(await data.toBuffer())

    return
  }
}
