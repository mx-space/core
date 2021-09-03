import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'
import { Auth } from '~/common/decorator/auth.decorator'
import { IConfig } from '../configs/configs.interface'
import { ConfigsService } from '../configs/configs.service'
import { OptionService } from './option.service'

class ConfigKeyDto {
  @IsString()
  @IsNotEmpty()
  key: keyof IConfig
}

@Controller(['options', 'config', 'setting'])
@ApiTags('Option Routes')
@Auth()
export class OptionController {
  constructor(
    private readonly adminService: OptionService,
    private readonly configs: ConfigsService,
  ) {}

  @Get()
  getOption() {
    return this.configs.getConfig()
  }

  @Get(':key')
  getOptionKey(@Param('key') key: keyof IConfig) {
    if (typeof key !== 'string' && !key) {
      throw new UnprocessableEntityException(
        'key must be IConfigKeys, got ' + key,
      )
    }
    const value = this.configs.get(key)
    if (!value) {
      throw new UnprocessableEntityException('key is not exists.')
    }
    return { data: value }
  }

  @Patch(':key')
  patch(@Param() params: ConfigKeyDto, @Body() body: Record<string, any>) {
    if (typeof body !== 'object') {
      throw new UnprocessableEntityException('body must be object')
    }
    return this.adminService.patchAndValid(params.key, body)
  }
}
