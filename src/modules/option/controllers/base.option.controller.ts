import {
  BadRequestException,
  Body,
  Get,
  Param,
  Patch,
  UnprocessableEntityException,
} from '@nestjs/common'
import { instanceToPlain } from 'class-transformer'
import { ConfigKeyDto } from '../dtos/config.dto'
import { OptionController } from '../option.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { classToJsonSchema } from '~/utils/jsonschema.util'

@OptionController()
export class BaseOptionController {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly configs: ConfigsService,
  ) {}

  @Get('/')
  getOption() {
    return instanceToPlain(this.configs.getConfig())
  }

  @HTTPDecorators.Bypass
  @Get('/jsonschema')
  getJsonSchema() {
    return classToJsonSchema(IConfig)
  }

  @Get('/:key')
  async getOptionKey(@Param('key') key: keyof IConfig) {
    if (typeof key !== 'string' && !key) {
      throw new UnprocessableEntityException(
        `key must be IConfigKeys, got ${key}`,
      )
    }
    const value = await this.configs.get(key)
    if (!value) {
      throw new BadRequestException('key is not exists.')
    }
    return { data: instanceToPlain(value) }
  }

  @Patch('/:key')
  patch(@Param() params: ConfigKeyDto, @Body() body: Record<string, any>) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.configsService.patchAndValid(params.key, body)
  }
}
