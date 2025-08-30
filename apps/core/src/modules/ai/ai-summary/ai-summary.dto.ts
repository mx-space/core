import { TransformBoolean } from '~/common/decorators/transform-boolean.decorator'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

class BaseLangQueryDto {
  @IsString()
  @IsOptional()
  lang: string
}

export class GenerateAiSummaryDto extends BaseLangQueryDto {
  @IsString()
  refId: string
}

export class GetSummaryQueryDto extends BaseLangQueryDto {
  @IsOptional()
  @IsBoolean()
  @TransformBoolean()
  onlyDb?: boolean
}

export class UpdateSummaryDto {
  @IsString()
  summary: string
}
