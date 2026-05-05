import { Body, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
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

  private async assertNotInitialized(
    code: ErrorCodeEnum = ErrorCodeEnum.InitAlreadyCompleted,
  ) {
    if (await this.initService.isInit()) {
      throw new BizException(code)
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
    await this.assertNotInitialized(ErrorCodeEnum.InitForbidden)
    return this.configs.defaultConfig
  }

  @Patch('/configs/:key')
  async patch(
    @Param() params: ConfigKeyDto,
    @Body() body: Record<string, any>,
  ) {
    await this.assertNotInitialized()
    if (typeof body !== 'object') {
      throw new BizException(ErrorCodeEnum.InvalidBody)
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
      throw new BizException(ErrorCodeEnum.MineZip, `got: ${mimetype}`)
    }

    await this.backupService.saveTempBackupByUpload(await data.toBuffer())

    return
  }
}
