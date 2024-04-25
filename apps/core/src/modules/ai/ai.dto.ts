import { IsOptional, IsString } from 'class-validator'

export class LangQueryDto {
  @IsString()
  @IsOptional()
  lang: string
}

export class GenerateAiSummaryDto extends LangQueryDto {
  @IsString()
  refId: string
}
