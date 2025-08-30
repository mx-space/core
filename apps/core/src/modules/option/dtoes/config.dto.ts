import type { IConfig } from '~/modules/configs/configs.interface'
import { IsNotEmpty, IsString } from 'class-validator'

export class ConfigKeyDto {
  @IsString()
  @IsNotEmpty()
  key: keyof IConfig
}
