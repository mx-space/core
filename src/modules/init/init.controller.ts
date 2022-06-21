import {
  BadRequestException,
  Body,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Scope,
  UnprocessableEntityException,
} from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'

import { ConfigsService } from '../configs/configs.service'
import { ConfigKeyDto } from '../option/dtos/config.dto'
import { InitService } from './init.service'

@ApiController({
  path: '/init',
  scope: Scope.REQUEST,
})
@ApiName
export class InitController {
  constructor(
    private readonly configs: ConfigsService,

    private readonly initService: InitService,
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
      throw new BadRequestException('已经完成初始化, 请登录后进行设置')
    }
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.configs.patchAndValid(params.key, body)
  }
}
