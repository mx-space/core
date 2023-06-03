import { Transform } from 'class-transformer'
import { IsString } from 'class-validator'

export class CategoryAndSlugDto {
  @IsString()
  readonly category: string

  @IsString()
  @Transform(({ value: v }) => decodeURI(v))
  readonly slug: string
}
