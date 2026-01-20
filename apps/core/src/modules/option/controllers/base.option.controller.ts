import {
  BadRequestException,
  Body,
  Get,
  Param,
  Patch,
  UnprocessableEntityException,
} from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import {
  attachAiProviderOptionsToFormDSL,
  generateFormDSL,
} from '~/modules/configs/configs.dsl.util'
import { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { OptionController } from '../option.decorator'

@OptionController()
export class BaseOptionController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get('/')
  getOption() {
    return this.configsService.getConfig()
  }

  @HTTPDecorators.Bypass
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
    if (typeof key !== 'string' && !key) {
      throw new UnprocessableEntityException(
        `key must be IConfigKeys, got ${key}`,
      )
    }
    const value = await this.configsService.get(key)
    if (!value) {
      throw new BadRequestException('key is not exists.')
    }
    return { data: value }
  }

  @Patch('/:key')
  patch(@Param('key') key: keyof IConfig, @Body() body: Record<string, any>) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.configsService.patchAndValid(key, body)
  }
}
