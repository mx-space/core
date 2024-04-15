import { Type } from 'class-transformer'
import { IsString, ValidateNested } from 'class-validator'

class Keys {
  @IsString()
  p256dh: string
  @IsString()
  auth: string
}

export class WebpushSubscriptionDto {
  @IsString()
  endpoint: string
  @Type(() => Keys)
  @ValidateNested()
  keys: Keys
}
