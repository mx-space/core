import { IsBoolean, IsOptional, IsString } from 'class-validator'

import { TransformBoolean } from '~/common/decorators/transform-boolean.decorator'

class BaseLangQueryDto {
  @IsString()
  @IsOptional()
  lang: string
}

export class GenerateAiDeepReadingDto extends BaseLangQueryDto {
  @IsString()
  refId: string
}

export class GetDeepReadingQueryDto extends BaseLangQueryDto {
  @IsOptional()
  @IsBoolean()
  @TransformBoolean()
  onlyDb?: boolean
}

export class UpdateDeepReadingDto {
  @IsString()
  deepReading: string

  @IsString()
  @IsOptional()
  criticalAnalysis?: string

  @IsString({ each: true })
  @IsOptional()
  keyPoints?: string[]

  @IsString()
  @IsOptional()
  content?: string
}
