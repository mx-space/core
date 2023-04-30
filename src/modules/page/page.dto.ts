import { Type } from 'class-transformer'
import { IsInt, IsMongoId, Min, ValidateNested } from 'class-validator'

class Seq {
  @IsMongoId()
  id: string
  @IsInt()
  @Min(1)
  order: number
}
export class PageReorderDto {
  @Type(() => Seq)
  @ValidateNested()
  seq: Seq[]
}
