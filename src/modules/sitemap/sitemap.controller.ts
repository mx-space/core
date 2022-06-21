import { uniq } from 'lodash'

import { CacheKey, CacheTTL, Controller, Get, Header } from '@nestjs/common'

import { apiRoutePrefix } from '~/common/decorator/api-controller.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CacheKeys } from '~/constants/cache.constant'

import { AggregateService } from '../aggregate/aggregate.service'

@Controller()
@ApiName
export class SitemapController {
  constructor(private readonly aggregateService: AggregateService) {}

  // TODO drop 兼容老版本
  @Get(uniq(['/sitemap', `${apiRoutePrefix}/sitemap`]))
  @CacheTTL(3600)
  @CacheKey(CacheKeys.SiteMapXmlCatch)
  @HTTPDecorators.Bypass
  @Header('content-type', 'application/xml')
  async getSitemap() {
    const content = await this.aggregateService.getSiteMapContent()

    const xml = `
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  ${content
    .map(
      (item) => `<url>
  <loc>${item.url}</loc>
  <lastmod>${item.published_at?.toISOString() || 'N/A'}</lastmod>
  </url>`,
    )

    .join('')}
  </urlset>
  `.trim()
    return xml
  }
}
