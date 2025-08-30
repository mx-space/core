import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Controller, Get, Header } from '@nestjs/common'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { AggregateService } from '../aggregate/aggregate.service'

@Controller()
export class SitemapController {
  constructor(private readonly aggregateService: AggregateService) {}

  @Get('/sitemap')
  @CacheTTL(3600)
  @CacheKey(CacheKeys.SiteMapXml)
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
  <changefreq>daily</changefreq>
  </url>`,
    )

    .join('')}
  </urlset>
  `.trim()
    return xml
  }
}
