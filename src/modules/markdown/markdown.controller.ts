import {
  Body,
  CacheTTL,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import dayjs from 'dayjs'
import { minify } from 'html-minifier'
import JSZip from 'jszip'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { Readable } from 'stream'
import { URL } from 'url'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { AssetService } from '~/processors/helper/hepler.asset.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { CategoryModel } from '../category/category.model'
import { ConfigsService } from '../configs/configs.service'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { DataListDto, ExportMarkdownQueryDto } from './markdown.dto'
import { MarkdownYAMLProperty } from './markdown.interface'
import { MarkdownService } from './markdown.service'

@Controller('markdown')
@ApiName
export class MarkdownController {
  constructor(
    private readonly service: MarkdownService,

    private readonly assetService: AssetService,
    private readonly configs: ConfigsService,
  ) {}

  @Post('/import')
  @Auth()
  @ApiProperty({ description: '导入 Markdown YAML 数据' })
  async importArticle(@Body() body: DataListDto) {
    const type = body.type

    switch (type) {
      case ArticleTypeEnum.Post: {
        return await this.service.insertPostsToDb(body.data)
      }
      case ArticleTypeEnum.Note: {
        return await this.service.insertNotesToDb(body.data)
      }
    }
  }

  @Get('/export')
  @Auth()
  @ApiProperty({ description: '导出 Markdown YAML 数据' })
  @HTTPDecorators.Bypass
  @Header('Content-Type', 'application/zip')
  async exportArticleToMarkdown(@Query() query: ExportMarkdownQueryDto) {
    const { show_title: showTitle, slug, yaml } = query
    const allArticles = await this.service.extractAllArticle()
    const { notes, pages, posts } = allArticles

    const convertor = <
      T extends {
        text: string
        created?: Date
        modified: Date
        title: string
        slug?: string
      },
    >(
      item: T,
      extraMetaData: Record<string, any> = {},
    ): MarkdownYAMLProperty => {
      const meta = {
        created: item.created,
        modified: item.modified,
        title: item.title,
        slug: item.slug || item.title,
        ...extraMetaData,
      }
      return {
        meta,
        text: this.service.markdownBuilder(
          { meta, text: item.text },
          yaml,
          showTitle,
        ),
      }
    }
    // posts
    const convertPost = posts.map((post) =>
      convertor(post, {
        categories: (post.category as CategoryModel).name,
        type: 'post',
        permalink: 'posts/' + post.slug,
      }),
    )
    const convertNote = notes.map((note) =>
      convertor(note, {
        mood: note.mood,
        weather: note.weather,
        id: note.nid,
        permalink: 'notes/' + note.nid,
        type: 'note',
        slug: note.nid.toString(),
      }),
    )
    const convertPage = pages.map((page) =>
      convertor(page, {
        subtitle: page.subtitle,
        type: 'page',
        permalink: page.slug,
      }),
    )

    // zip
    const map = {
      posts: convertPost,
      pages: convertPage,
      notes: convertNote,
    }

    const rtzip = new JSZip()

    await Promise.all(
      Object.entries(map).map(async ([key, arr]) => {
        const zip = await this.service.generateArchive({
          documents: arr,
          options: {
            slug,
          },
        })

        zip.forEach(async (relativePath, file) => {
          rtzip.file(join(key, relativePath), file.nodeStream())
        })
      }),
    )

    const readable = new Readable()
    readable.push(await rtzip.generateAsync({ type: 'nodebuffer' }))
    readable.push(null)

    return readable
  }

  @Get('/render/:id')
  @Header('content-type', 'text/html')
  @HTTPDecorators.Bypass
  @CacheTTL(60 * 60)
  async renderArticle(@Param() params: MongoIdDto) {
    const { id } = params
    const now = performance.now()
    const {
      html: markdown,
      document,
      type,
    } = await this.service.renderArticle(id)

    const relativePath = (() => {
      switch (type.toLowerCase()) {
        case 'post':
          return `/posts/${((document as PostModel).category as any).slug}/${
            (document as PostModel).slug
          }`
        case 'note':
          return `/notes/${(document as NoteModel).nid}`
        case 'page':
          return `/${(document as PageModel).slug}`
      }
    })()
    const {
      url: { webUrl },
    } = await this.configs.waitForConfigReady()
    const url = new URL(relativePath, webUrl)

    const { style, link, script, extraScripts, body } =
      await this.service.getRenderedMarkdownHtmlStructure(
        markdown,
        document.title,
      )

    const html = minify(
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <meta name="referrer" content="no-referrer">
        <style>
          ${style.join('\n')}
        </style>
        ${link.join('\n')}
        <title>${document.title}</title>
      </head>
      <body>
     ${body.join('\n')}
        </body>
        <footer style="text-align: right; padding: 2em 0;">
        <p>本文渲染于 ${dayjs().format('llll')}，用时 ${
        performance.now() - now
      }ms</p>
        <p>原文地址：<a href="${url}">${decodeURIComponent(
        url.toString(),
      )}</a></p>
        </footer>
      ${extraScripts.join('\n')}
      <script>
      ${script.join(';')}
      </script>
      </html>
    `,
      {
        removeAttributeQuotes: true,
        removeComments: true,
        minifyCSS: true,
        collapseWhitespace: true,
      },
    )
    return html
  }

  @Get('/render/structure/:id')
  @CacheTTL(60 * 60)
  async getRenderedMarkdownHtmlStructure(@Param() params: MongoIdDto) {
    const { id } = params
    const { html, document } = await this.service.renderArticle(id)
    return this.service.getRenderedMarkdownHtmlStructure(html, document.title)
  }
}
