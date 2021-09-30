import { CacheKey, CacheTTL, Controller, Get, Header } from '@nestjs/common'
import { minify } from 'html-minifier'
import xss from 'xss'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { AggregateService } from '../aggregate/aggregate.service'
import { ConfigsService } from '../configs/configs.service'
import { MarkdownService } from '../markdown/markdown.service'

@Controller('feed')
@ApiName
export class FeedController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly configs: ConfigsService,
    private readonly markdownService: MarkdownService,
  ) {}

  @Get('/')
  @CacheKey(CacheKeys.RSSXmlCatch)
  @CacheTTL(3600)
  @HTTPDecorators.Bypass
  @Header('content-type', 'application/xml')
  async rss() {
    const { author, data, url } =
      await this.aggregateService.buildRssStructure()
    const { title } = this.configs.get('seo')
    const { avatar } = await this.configs.getMaster()
    const now = new Date()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>${title}</title>
      <link href="/atom.xml" rel="self"/>
      <link href="/feed" rel="self"/>
      <link href="${xss(url)}"/>
      <updated>${now.toISOString()}</updated>
      <id>${xss(url)}</id>
      <author>
        <name>${author}</name>
      </author>
      <generator>${'Mix Space CMS'}</generator>
      <lastBuildDate>${now.toISOString()}</lastBuildDate>
      <language>zh-CN</language>
      <image>
          <url>${xss(avatar)}</url>
          <title>${title}</title>
          <link>${xss(url)}</link>
      </image>
        ${data
          .map((item) => {
            return `<entry>
            <title>${item.title}</title>
            <link href='${xss(item.link)}'/>
            <id>${xss(item.link)}</id>
            <published>${item.created}</published>
            <updated>${item.modified}</updated>
            <content type='html'><![CDATA[
              ${minify(
                `<blockquote>该渲染由 marked 生成, 可能存在部分语句不通或者排版问题, 最佳体验请前往: <a href='${xss(
                  item.link,
                )}'>${xss(item.link)}</a></blockquote>
              ${this.markdownService.renderMarkdownContent(item.text)}
              <p style='text-align: right'>
              <a href='${xss(item.link) + '#comments'}'>看完了？说点什么呢</a>
              </p>`,
                {
                  collapseWhitespace: true,
                  removeAttributeQuotes: true,
                  removeComments: true,
                  removeTagWhitespace: true,
                },
              )}
            ]]>
            </content>
            </entry>
          `
          })
          .join('')}
    </feed>`

    return xml
  }
}
