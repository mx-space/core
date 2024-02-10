import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class UpdatePresenceDto {
  @IsString()
  identity: string

  @IsString()
  roomName: string

  @IsNumber()
  ts: number

  @IsNumber()
  @Min(0)
  position: number

  @IsOptional()
  @IsString()
  displayName?: string

  @IsString()
  sid: string
}

export class GetPresenceQueryDto {
  @IsString()
  room_name: string
}
