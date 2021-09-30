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
import { render } from 'ejs'
import { minify } from 'html-minifier'
import JSZip from 'jszip'
import { sample } from 'lodash'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { Readable } from 'stream'
import { URL } from 'url'
import xss from 'xss'
import { Auth } from '~/common/decorator/auth.decorator'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { CategoryModel } from '../category/category.model'
import { ConfigsService } from '../configs/configs.service'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import {
  DataListDto,
  ExportMarkdownQueryDto,
  MarkdownPreviewDto,
} from './markdown.dto'
import { MarkdownYAMLProperty } from './markdown.interface'
import { MarkdownService } from './markdown.service'

@Controller('markdown')
@ApiName
export class MarkdownController {
  constructor(
    private readonly service: MarkdownService,

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
  async renderArticle(
    @Param() params: MongoIdDto,
    @Query('theme') theme: string,
  ) {
    const { id } = params
    const now = performance.now()
    const [
      { html: markdown, document, type },
      {
        url: { webUrl },
      },
      { name: username },
    ] = await Promise.all([
      this.service.renderArticle(id),
      this.configs.waitForConfigReady(),
      this.configs.getMaster(),
    ])

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

    const url = new URL(relativePath, webUrl)

    const structure = await this.service.getRenderedMarkdownHtmlStructure(
      markdown,
      document.title,
    )

    const html = render(await this.service.getMarkdownEjsRenderTemplate(), {
      theme:
        theme === 'random'
          ? sample(this.service.getMarkdownRenderTheme())
          : xss(theme),

      ...structure,

      title: document.title,
      footer: `<p>本文渲染于 ${dayjs().format(
        'MM/DD/YY H:mm:ss',
      )}，由 marked.js 解析生成，用时 ${(performance.now() - now).toFixed(
        2,
      )}ms</p>
      <p>作者：${username}，撰写于${dayjs(document.created).format('llll')}</p>
        <p>原文地址：<a href="${url}">${decodeURIComponent(
        url.toString(),
      )}</a></p>
        `,
    })

    return minify(html, {
      removeAttributeQuotes: true,
      removeComments: true,
      minifyCSS: true,
      collapseWhitespace: true,
    })
  }

  /**
   * 后台预览 Markdown 可用接口, 传入 `title` 和 `md`
   */
  @Post('/render')
  @HttpCache.disable
  @Auth()
  @HTTPDecorators.Bypass
  @Header('content-type', 'text/html')
  async markdownPreview(
    @Body() body: MarkdownPreviewDto,
    @Query('theme') theme: string,
  ) {
    const { md, title } = body
    const html = this.service.renderMarkdownContent(md)
    const structure = await this.service.getRenderedMarkdownHtmlStructure(
      html,
      title,
    )
    return minify(
      render(await this.service.getMarkdownEjsRenderTemplate(), {
        ...structure,
        theme: xss(theme),
        title: xss(title),
      }),
    )
  }

  @Get('/render/structure/:id')
  @CacheTTL(60 * 60)
  async getRenderedMarkdownHtmlStructure(@Param() params: MongoIdDto) {
    const { id } = params
    const { html, document } = await this.service.renderArticle(id)
    return this.service.getRenderedMarkdownHtmlStructure(html, document.title)
  }
}
