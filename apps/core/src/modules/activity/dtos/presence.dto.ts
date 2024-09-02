import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'

export class UpdatePresenceDto {
  @IsString()
  @MaxLength(200)
  identity: string

  @IsString()
  @MaxLength(50)
  roomName: string

  @IsNumber()
  ts: number

  @IsNumber()
  @Min(0)
  position: number

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string

  @IsString()
  @MaxLength(30)
  sid: string

  @IsMongoId()
  @IsOptional()
  readerId?: string
}

export class GetPresenceQueryDto {
  @IsString()
  @MaxLength(50)
  room_name: string
}
