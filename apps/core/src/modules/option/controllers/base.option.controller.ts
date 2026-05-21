import { Body, Get, Param, Patch } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import {
  attachAiProviderOptionsToFormDSL,
  generateFormDSL,
} from '~/modules/configs/configs.dsl.util'
import { sanitizeConfigForResponse } from '~/modules/configs/configs.encrypt.util'
import { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'

import { OptionController } from '../option.decorator'

@OptionController()
export class BaseOptionController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get('/')
  getOption() {
    return this.configsService.getConfigForResponse()
  }

  @Get('/form-schema')
  async getFormSchema() {
    const schema = generateFormDSL()
    schema.defaults = this.configsService.defaultConfig

    const aiConfig = await this.configsService.get('ai')
    attachAiProviderOptionsToFormDSL(schema, aiConfig)

    return schema
  }

  @Get('/:key')
  async getOptionKey(@Param('key') key: keyof IConfig) {
    const value = await this.configsService.getForResponse(key)
    if (!value) {
      throw createAppException(AppErrorCode.CONFIG_NOT_FOUND, {
        id: key as string,
      })
    }
    return value
  }

  @Patch('/:key')
  async patch(
    @Param('key') key: keyof IConfig,
    @Body() body: Record<string, any>,
  ) {
    if (typeof body !== 'object') {
      throw createAppException(AppErrorCode.INVALID_BODY)
    }
    const result = await this.configsService.patchAndValid(key, body)
    return sanitizeConfigForResponse(result as object, key)
  }
}
