import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'
import { SnippetModel } from './snippet.model'

export class SnippetMoreDto {
  @ValidateNested({ each: true })
  @Type(() => SnippetModel)
  snippets: SnippetModel[]

  @IsString({ each: true })
  @IsOptional()
  packages?: string[]
}
