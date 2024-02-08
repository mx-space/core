import { IsNumber, IsString, Min } from 'class-validator'

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
}

export class GetPresenceQueryDto {
  @IsString()
  room_name: string
}
