import {
  BadRequestException,
  Body,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { UploadService } from '~/processors/helper/helper.upload.service'
import { isZipMinetype } from '~/utils/mine.util'
import { FastifyRequest } from 'fastify'
import { BackupService } from '../backup/backup.service'
import { ConfigsService } from '../configs/configs.service'
import { ConfigKeyDto } from '../option/dtoes/config.dto'
import { InitGuard } from './init.guard'
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

  @Get('/')
  async isInit() {
    return {
      isInit: await this.initService.isInit(),
    }
  }

  @Get('/configs/default')
  async getDefaultConfig() {
    const { isInit } = await this.isInit()
    if (isInit) {
      throw new ForbiddenException('默认设置在完成注册之后不可见')
    }
    return this.configs.defaultConfig
  }

  @Patch('/configs/:key')
  async patch(
    @Param() params: ConfigKeyDto,
    @Body() body: Record<string, any>,
  ) {
    const { isInit } = await this.isInit()
    if (isInit) {
      throw new BadRequestException('已经完成初始化，请登录后进行设置')
    }
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.configs.patchAndValid(params.key, body)
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
