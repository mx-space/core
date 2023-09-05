import xss from 'xss'

import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Controller, Get, Header } from '@nestjs/common'

import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { escapeXml, toISO8601DateTime } from '~/utils'

import { AggregateService } from '../aggregate/aggregate.service'
import { ConfigsService } from '../configs/configs.service'
import { MarkdownService } from '../markdown/markdown.service'

@Controller()
export class FeedController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly configs: ConfigsService,
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
    const { avatar } = await this.configs.getMaster()
    const now = new Date()
    // const xml = `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
    // <feed xmlns="http://www.w3.org/2005/Atom">
    //   <title>${title}</title>
    //   <link href="/atom.xml" rel="self"/>
    //   <link href="/feed" rel="self"/>
    //   <link href="${xss(url)}"/>
    //   <updated>${now.toISOString()}</updated>
    //   <id>${xss(url)}</id>
    //   <author>
    //     <name>${author}</name>
    //   </author>
    //   <generator>Mix Space CMS</generator>
    //   <lastBuildDate>${now.toISOString()}</lastBuildDate>
    //   <language>zh-CN</language>
    //   <image>
    //       <url>${xss(avatar || '')}</url>
    //       <title>${title}</title>
    //       <link>${xss(url)}</link>
    //   </image>
    //     ${await Promise.all(
    //       data.map(async (item) => {
    //         return `<entry>
    //         <title>${escapeXml(item.title)}</title>
    //         <link href='${xss(item.link)}'/>
    //         <id>${xss(item.link)}</id>
    //         <published>${item.created}</published>
    //         <updated>${item.modified}</updated>
    //         <content type='html'><![CDATA[
    //           ${`<blockquote>该渲染由 marked 生成，可能存在排版问题，最佳体验请前往：<a href='${xss(
    //             item.link,
    //           )}'>${xss(item.link)}</a></blockquote>
    //           ${await this.markdownService
    //             .renderArticle(item.id)
    //             .then((res) => res.html)}
    //           <p style='text-align: right'>
    //           <a href='${`${xss(item.link)}#comments`}'>看完了？说点什么呢</a>
    //           </p>`}
    //         ]]>
    //         </content>
    //         </entry>
    //       `
    //       }),
    //     ).then((res) => res.join(''))}
    // </feed>`
    //

    const xml = `<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
<channel>
<atom:link href="${xss(url)}/feed" rel="self" type="application/rss+xml"/>
<title>${title}</title>
<link>${xss(url)}</link>
<description>${description}</description>
<language>zh-CN</language>
<copyright>© ${author} </copyright>
<pubDate>${toISO8601DateTime(now)}</pubDate>
<generator>Mix Space CMS (https://github.com/mx-space)</generator>
<docs>https://mx-space.js.org</docs>
<image>
    <url>${xss(avatar || '')}</url>
    <title>${title}</title>
    <link>${xss(url)}</link>
</image>
${await Promise.all(
  data.map(async (item) => {
    return `<item>
    <title>${escapeXml(item.title)}</title>
    <link>${xss(item.link)}</link>
    <pubDate>${toISO8601DateTime(item.created!)}</pubDate>
    <content:encoded><![CDATA[
      ${`<blockquote>该渲染由 marked 生成，可能存在排版问题，最佳体验请前往：<a href='${xss(
        item.link,
      )}'>${xss(item.link)}</a></blockquote>
      ${await this.markdownService
        .renderArticle(item.id)
        .then((res) => res.html)}
      <p style='text-align: right'>
      <a href='${`${xss(item.link)}#comments`}'>看完了？说点什么呢</a>
      </p>`}
    ]]>
    </content:encoded>
  <guid isPermaLink="false">${item.id}</guid>
 </item>
  `
  }),
).then((res) => res.join(''))}
</channel>
</rss>`

    return xml
  }
}
