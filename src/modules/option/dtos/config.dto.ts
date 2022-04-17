import { IsNotEmpty, IsString } from 'class-validator'

import { IConfig } from '~/modules/configs/configs.interface'

export class ConfigKeyDto {
  @IsString()
  @IsNotEmpty()
  key: keyof IConfig
}
