import { CollectionRefTypes } from '~/constants/db.constant'
import { normalizeRefType } from '~/utils/database.util'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'

export class CommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20, { message: '昵称不得大于 20 个字符' })
  author: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: '评论内容不得大于 500 个字符' })
  text: string

  @IsString()
  @IsEmail(undefined, { message: '请更正为正确的邮箱' })
  @MaxLength(50, { message: '邮箱地址不得大于 50 个字符' })
  mail: string

  @IsString()
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  @IsOptional()
  @MaxLength(50, { message: '地址不得大于 50 个字符' })
  url?: string

  @IsOptional()
  @IsBoolean()
  isWhispers?: boolean

  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    {
      message: '头像必须是合法的 HTTPS URL 哦',
    },
  )
  avatar?: string
}

export class EditCommentDto {
  @IsString()
  @IsNotEmpty()
  text: string
}

export class RequiredGuestReaderCommentDto extends CommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20, { message: '昵称不得大于 20 个字符' })
  author: string

  @IsString()
  @IsEmail(undefined, { message: '请更正为正确的邮箱' })
  @MaxLength(50, { message: '邮箱地址不得大于 50 个字符' })
  mail: string
}

export class TextOnlyDto {
  @IsString()
  @IsNotEmpty()
  text: string

  @IsOptional()
  @IsString()
  source?: string
}

export class CommentRefTypesDto {
  @IsOptional()
  @IsEnum(CollectionRefTypes)
  @Transform(({ value }) => {
    if (!value) return
    return normalizeRefType(value as any)
  })
  ref?: CollectionRefTypes
}

export class CommentStatePatchDto {
  @IsInt()
  @IsIn([0, 1, 2])
  @IsOptional()
  state?: number

  @IsOptional()
  @IsBoolean()
  pin?: boolean
}
