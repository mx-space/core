import RemoveMarkdown from 'remove-markdown'
import xss from 'xss'

import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Controller, Get, Header } from '@nestjs/common'

import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { escapeXml } from '~/utils'

import { AggregateService } from '../aggregate/aggregate.service'
import { ConfigsService } from '../configs/configs.service'
import { MarkdownService } from '../markdown/markdown.service'
import { UserService } from '../user/user.service'
import type { CategoryModel } from '../category/category.model'

@Controller()
export class FeedController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly configs: ConfigsService,
    private readonly userService: UserService,
    private readonly markdownService: MarkdownService,
  ) {}

  @Get(['/feed', '/atom.xml'])
  @CacheKey(CacheKeys.RSSXml)
  @CacheTTL(3600)
  @HTTPDecorators.Bypass
  @Header('content-type', 'application/xml')
  async rss() {
    const { author, data, url, description } =
      await this.aggregateService.buildRssStructure()
    const { title } = await this.configs.get('seo')
    const { avatar } = await this.userService.getMaster()
    const now = new Date()
    const xml = `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
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
${await Promise.all(
  data.map(async (item) => {
    const renderResult = await this.markdownService.renderArticle(item.id)
    return `<item>
    <title>${escapeXml(item.title)}</title>
    <link>${xss(item.link)}</link>
    <pubDate>${item.created!.toUTCString()}</pubDate>
    <description>${escapeXml(
      xss(RemoveMarkdown(renderResult.document.text).slice(0, 50)),
    )}</description>
    <content:encoded><![CDATA[
      ${`<blockquote>该渲染由 marked 生成，可能存在排版问题，最佳体验请前往：<a href='${xss(
        item.link,
      )}'>${xss(item.link)}</a></blockquote>
      ${renderResult.html}
      <p style='text-align: right'>
      <a href='${`${xss(item.link)}#comments`}'>看完了？说点什么呢</a>
      </p>`}
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
).then((res) => res.join(''))}
</channel>
</rss>`

    return xml
  }
}
