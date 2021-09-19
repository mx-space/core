import { Transform } from 'class-transformer'
import { IsIP, IsNumber, IsString } from 'class-validator'

export class IpDto {
  @IsIP()
  ip: string
}

export class GaodeMapLocationDto {
  // 经度
  @IsNumber()
  @Transform(({ value }) => +value)
  longitude: string

  // 纬度
  @IsNumber()
  @Transform(({ value }) => +value)
  latitude: string
}

export class GaodeMapSearchDto {
  @IsString()
  keywords: string
}
