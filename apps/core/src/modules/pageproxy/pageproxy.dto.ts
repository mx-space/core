import { IsAllowedUrl } from '~/decorators/dto/isAllowedUrl'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsSemVer } from 'class-validator'

export class PageProxyDebugDto {
  @IsIn([false])
  @IsOptional()
  @Transform(({ value }) => (value === 'false' ? false : true))
  __debug: boolean
  @IsAllowedUrl()
  @IsOptional()
  __apiUrl?: string

  @IsAllowedUrl()
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
   * 无缓存访问，redis no
   */
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : false))
  @IsOptional()
  __purge = false

  @IsBoolean()
  @IsOptional()
  __local = false
}
