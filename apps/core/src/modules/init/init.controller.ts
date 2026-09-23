import {
  BadRequestException,
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
import {
  FileInterceptor,
  type UploadedMultipartFile,
} from '@nestjs/platform-fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { isZipMinetype } from '~/utils/mine.util'

import { BackupService } from '../backup/backup.service'
import { ConfigsService } from '../configs/configs.service'
import { type ConfigKeyDto, ConfigKeySchema } from '../option/option.schema'
import { InitGuard, InitRestoreGuard } from './init.guard'
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
  @UseGuards(InitRestoreGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 * 100 },
      fileFilter: (_req, file, done) => {
        if (!isZipMinetype(file.mimetype)) {
          done(
            createAppException(AppErrorCode.INIT_INVALID_MIME_TYPE, {
              got: file.mimetype,
            }),
            false,
          )
          return
        }
        done(null, true)
      },
    }),
  )
  async uploadAndRestore(@UploadedFile() data?: UploadedMultipartFile) {
    await this.assertNotInitialized()
    if (!data?.buffer) {
      throw new BadRequestException('Only file uploads are accepted!')
    }
    await this.backupService.saveTempBackupByUpload(data.buffer)

    return
  }
}
