import {
  BadRequestException,
  Body,
  Get,
  Param,
  Patch,
  UnprocessableEntityException,
} from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { classToJsonSchema } from '~/utils/jsonschema.util'
import { ConfigKeyDto } from '../dtoes/config.dto'
import { OptionController } from '../option.decorator'

@OptionController()
export class BaseOptionController {
  constructor(private readonly configsService: ConfigsService) {}

  @HTTPDecorators.Bypass
  @Get('/')
  async getOption() {
    const config = await this.configsService.getConfig()
    return JSON.parse(JSON.stringify(config))
  }

  @HTTPDecorators.Bypass
  @Get('/jsonschema')
  getJsonSchema() {
    return Object.assign(classToJsonSchema(IConfig), {
      default: this.configsService.defaultConfig,
    })
  }

  @HTTPDecorators.Bypass
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
    return { data: JSON.parse(JSON.stringify(value)) }
  }

  @HTTPDecorators.Bypass
  @Patch('/:key')
  async patch(
    @Param() params: ConfigKeyDto,
    @Body() body: Record<string, any>,
  ) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    const result = await this.configsService.patchAndValid(params.key, body)
    return JSON.parse(JSON.stringify(result))
  }
}
