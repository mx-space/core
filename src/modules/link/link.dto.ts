import { IsString } from 'class-validator'

export class LinkQueryDto {
  @IsString()
  author: string
}
