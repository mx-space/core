import { IsNotEmpty, IsString } from 'class-validator'
import type { IConfig } from '~/modules/configs/configs.interface'

export class ConfigKeyDto {
  @IsString()
  @IsNotEmpty()
  key: keyof IConfig
}
