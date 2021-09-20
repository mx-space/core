import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsUrl } from 'class-validator'

export class PageProxyDebugDto {
  @IsIn([false])
  @IsOptional()
  @Transform(({ value }) => (value === 'false' ? false : true))
  __debug: boolean
  @IsUrl({ require_protocol: true })
  @IsOptional()
  __apiUrl?: string

  @IsUrl({ require_protocol: true })
  @IsOptional()
  __gatewayUrl?: string

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : false))
  /**
   * If true, always use index.html pull from github.
   */
  __onlyGithub = false
}
