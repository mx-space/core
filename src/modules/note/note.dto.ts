import { ArgsType, Field, Int } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import {
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

@ArgsType()
export class NoteQueryDto extends PagerDto {
  @IsOptional()
  @IsIn(['title', 'created', 'modified', 'weather', 'mood'])
  sortBy?: string

  @IsOptional()
  @IsIn([1, -1])
  @ValidateIf((o) => o.sortBy)
  @Transform(({ value: v }) => v | 0)
  @Field(() => Int)
  sortOrder?: 1 | -1
}

export class PasswordQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  password?: string
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

export { NoteMusic as NoteMusicDto } from './note.model'
