import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsSemVer, IsUrl } from 'class-validator'

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
  @Transform(({ value }) => {
    return ['', 'true', true].includes(value) ? true : false
  })
  /**
   * If true, always use index.html pull from github.
   */
  __onlyGithub = false

  @IsOptional()
  @IsSemVer()
  @Transform(({ value }) => (value === 'latest' ? null : value))
  __version?: string

  /**
   * 无缓存访问, redis no
   */
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : false))
  @IsOptional()
  __purge = false
}
