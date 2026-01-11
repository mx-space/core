import { IsEnum, IsString, ValidateIf } from 'class-validator'

export enum AiQueryType {
  TitleSlug = 'title-slug',
  Slug = 'slug',
}

export class GenerateAiDto {
  @IsEnum(AiQueryType)
  type: AiQueryType

  @ValidateIf((o: GenerateAiDto) => o.type === AiQueryType.TitleSlug)
  @IsString()
  text: string

  @ValidateIf((o: GenerateAiDto) => o.type === AiQueryType.Slug)
  @IsString()
  title: string
}
