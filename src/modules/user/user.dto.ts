import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'

import { IsAllowedUrl } from '~/utils/validator/isAllowedUrl'

class UserOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '我是练习时长两年半的个人练习生' })
  readonly introduce?: string

  @ApiProperty({ required: false, example: 'example@example.com' })
  @IsEmail()
  @IsOptional()
  readonly mail?: string

  @ApiProperty({ required: false, example: 'http://example.com' })
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @IsOptional()
  readonly url?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({ required: false })
  @IsAllowedUrl()
  @IsOptional()
  readonly avatar?: string

  @IsOptional()
  @IsObject()
  @ApiProperty({ description: '各种社交 id 记录' })
  readonly socialIds?: Record<string, any>
}

export class UserDto extends UserOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '用户名？' })
  readonly username: string

  @IsString()
  @ApiProperty()
  @IsNotEmpty({ message: '密码？' })
  readonly password: string
}

export class LoginDto {
  @ApiProperty({ required: true })
  @IsString({ message: '用户名？' })
  username: string

  @ApiProperty({ required: true })
  @IsString({ message: '密码？' })
  password: string
}

export class UserPatchDto extends UserOptionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly username: string

  @IsString()
  @ApiProperty({ required: false })
  @IsNotEmpty()
  @IsOptional()
  readonly password: string
}
