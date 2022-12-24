import {
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class DanmakuDto {
  @IsString()
  @IsNotEmpty()
  author: string
  @IsOptional()
  @IsHexColor()
  color?: string

  @IsInt()
  @IsOptional()
  duration?: number

  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '长度不能超过 50 个字符' })
  text: string
}
