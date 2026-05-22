import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Controller, Get, Header } from '@nestjs/common'
import RemoveMarkdown from 'remove-markdown'
import xss from 'xss'

import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { ContentFormat } from '~/shared/types/content-format.type'
import { escapeXml } from '~/utils/tool.util'

import { AggregateService } from '../aggregate/aggregate.service'
import type { CategoryModel } from '../category/category.types'
import { ConfigsService } from '../configs/configs.service'
import { MarkdownService } from '../markdown/markdown.service'
import { OwnerService } from '../owner/owner.service'

@Controller()
export class FeedController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly configs: ConfigsService,
    private readonly ownerService: OwnerService,
    private readonly markdownService: MarkdownService,
  ) {}

  @Get(['/feed', '/atom.xml'])
  @CacheKey(CacheKeys.RSSXml)
  @CacheTTL(3600)
  @HTTPDecorators.RawResponse
  @Header('content-type', 'application/xml')
  async rss() {
    const { author, data, url, description } =
      await this.aggregateService.buildRssStructure()
    const { title } = await this.configs.get('seo')
    const { avatar } = await this.ownerService.getOwner()
    const now = new Date()
    const itemRenders = await Promise.all(
      data.map(async (item) => {
        const isLexical = item.contentFormat === ContentFormat.Lexical
        const renderResult = await this.markdownService.renderArticle(item.id)

        const description = isLexical
          ? 'Rich-text content; please visit the original site to view.'
          : escapeXml(
              xss(RemoveMarkdown(renderResult.document.text).slice(0, 50)),
            )

        const contentEncoded = isLexical
          ? `<p>View on the original site: <a href="${xss(item.link)}">${xss(item.link)}</a></p>`
          : `<blockquote>This rendering is produced by marked and may have formatting issues. For the best experience, visit: <a href='${xss(
              item.link,
            )}'>${xss(item.link)}</a></blockquote>
          ${renderResult.html}
          <p style='text-align: right'>
          <a href='${`${xss(item.link)}#comments`}'>Finished reading? Leave a comment</a>
          </p>`

        return `<item>
    <title>${escapeXml(item.title)}</title>
    <link>${xss(item.link)}</link>
    <pubDate>${item.created!.toUTCString()}</pubDate>
    <description>${description}</description>
    <content:encoded><![CDATA[
      ${contentEncoded}
    ]]>
    </content:encoded>
  <guid isPermaLink="false">${item.id}</guid>
  <category>${renderResult.type}</category>
${
  'category' in renderResult.document &&
  `<category>${
    (renderResult.document.category as CategoryModel).name
  }</category>`
}
 </item>
  `
      }),
    )
    const items = itemRenders.join('')

    return `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
<channel>
<atom:link href="${xss(url)}/feed" rel="self" type="application/rss+xml"/>
<title>${title}</title>
<link>${xss(url)}</link>
<description>${escapeXml(description)}</description>
<language>zh-CN</language>
<copyright>© ${author} </copyright>
<pubDate>${now.toUTCString()}</pubDate>
<generator>Mix Space CMS (https://github.com/mx-space)</generator>
<docs>https://mx-space.js.org</docs>
<image>
    <url>${xss(avatar || '')}</url>
    <title>${title}</title>
    <link>${xss(url)}</link>
</image>
${items}
</channel>
</rss>`
  }
}
