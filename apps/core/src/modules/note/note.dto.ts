import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'

import { PagerDto } from '~/shared/dto/pager.dto'

export class NoteQueryDto extends PagerDto {
  @IsOptional()
  @IsIn(['title', 'created', 'modified', 'weather', 'mood'])
  sortBy?: string

  @IsOptional()
  @IsIn([1, -1])
  @ValidateIf((o) => o.sortBy)
  @Transform(({ value: v }) => Math.trunc(v))
  sortOrder?: 1 | -1
}

export class NotePasswordQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  password?: string

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    return value === '1' || value === 'true' || value === true || value === 1
  })
  single?: boolean
}

export class ListQueryDto {
  @IsNumber()
  @Max(20)
  @Min(1)
  @Transform(({ value: v }) => Number.parseInt(v))
  @IsOptional()
  size: number
}

export class NidType {
  @IsInt()
  @Min(1)
  @IsDefined()
  @Transform(({ value: val }) => Number.parseInt(val))
  nid: number
}

export class SetNotePublishStatusDto {
  @IsBoolean()
  isPublished: boolean
}
