import { IsIP } from 'class-validator'

export class IpDto {
  @IsIP()
  ip: string
}
