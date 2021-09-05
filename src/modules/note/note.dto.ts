import { Transform } from 'class-transformer'
import {
  IsDefined,
  IsEnum,
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
  @IsEnum(['title', 'created', 'modified', 'weather', 'mood'])
  sortBy?: string

  @IsOptional()
  @IsEnum([1, -1])
  @ValidateIf((o) => o.sortBy)
  @Transform(({ value: v }) => v | 0)
  sortOrder?: 1 | -1
}

export class PasswordQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  password?: string
}

export class NoteMusicDto {
  @IsString()
  @IsNotEmpty()
  type: string

  @IsString()
  @IsNotEmpty()
  id: string
}
export class ListQueryDto {
  @IsNumber()
  @Max(20)
  @Min(1)
  @Transform(({ value: v }) => parseInt(v))
  @IsOptional()
  size: number
}

export class NidType {
  @IsInt()
  @Min(1)
  @IsDefined()
  @Transform(({ value: val }) => parseInt(val))
  nid: number
}
