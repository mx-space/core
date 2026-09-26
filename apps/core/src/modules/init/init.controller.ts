import {
  Body,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import type { UploadedMultipartFile } from '@nestjs/platform-fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { ZipUploadInterceptor } from '~/common/interceptors/zip-upload.interceptor'
import { requiredFilePipe } from '~/common/pipes/required-file.pipe'

import { BackupService } from '../backup/backup.service'
import { ConfigsService } from '../configs/configs.service'
import { type ConfigKeyDto, ConfigKeySchema } from '../option/option.schema'
import { InitGuard } from './init.guard'
import { type InitOwnerCreateDto, InitOwnerCreateSchema } from './init.schema'
import { InitService } from './init.service'

@ApiController('/init')
@UseGuards(InitGuard)
export class InitController {
  constructor(
    private readonly configs: ConfigsService,
    private readonly initService: InitService,
    private readonly backupService: BackupService,
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
    @Param({ schema: ConfigKeySchema }) params: ConfigKeyDto,
    @Body() body: Record<string, any>,
  ) {
    await this.assertNotInitialized()
    if (typeof body !== 'object') {
      throw createAppException(AppErrorCode.INIT_INVALID_BODY)
    }
    return this.configs.patchAndValid(params.key, body)
  }

  @Post('/owner')
  async createOwner(
    @Body({ schema: InitOwnerCreateSchema }) body: InitOwnerCreateDto,
  ) {
    await this.assertNotInitialized()
    return this.initService.createOwner(body)
  }

  @Post('/restore')
  @HttpCode(200)
  @UseInterceptors(
    ZipUploadInterceptor((got) =>
      createAppException(AppErrorCode.INIT_INVALID_MIME_TYPE, { got }),
    ),
  )
  async uploadAndRestore(
    @UploadedFile(requiredFilePipe) data: UploadedMultipartFile,
  ) {
    await this.assertNotInitialized()
    await this.backupService.saveTempBackupByUpload(data.buffer!)

    return
  }
}
