import { CacheTTL, Controller, Get, Header } from '@nestjs/common'
import { minify } from 'html-minifier'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { AggregateService } from '../aggregate/aggregate.service'
@Controller('sitemap')
@ApiName
export class SitemapController {
  constructor(private readonly aggregateService: AggregateService) {}

  @Get('/')
  @CacheTTL(3600)
  @HTTPDecorators.Bypass
  @Header('content-type', 'application/xml')
  async getSitemap() {
    const content = await this.aggregateService.getSiteMapContent()

    const xml = minify(
      `
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  ${content
    .map(
      (item) => `<url>
  <loc>${item.url}</loc>
  <lastmod>${item.published_at.toISOString()}</lastmod>
  </url>`,
    )
    .join('')}
  </urlset>
  `,
      { collapseWhitespace: true },
    )
    return xml
  }
}
