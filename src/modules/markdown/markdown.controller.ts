import {
  Body,
  CacheTTL,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiProperty, ApiQuery } from '@nestjs/swagger'
import dayjs from 'dayjs'
import { FastifyReply } from 'fastify'
import { minify } from 'html-minifier'
import JSZip from 'jszip'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { Readable } from 'stream'
import { URL } from 'url'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { AssetService } from '~/processors/helper/hepler.asset.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { CategoryModel } from '../category/category.model'
import { ConfigsService } from '../configs/configs.service'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { ArticleType, DataListDto } from './markdown.dto'
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
  @ApiProperty({ description: '导入 Markdown with YAML 数据' })
  async importArticle(@Body() body: DataListDto) {
    const type = body.type

    switch (type) {
      case ArticleType.Post: {
        return await this.service.insertPostsToDb(body.data)
      }
      case ArticleType.Note: {
        return await this.service.insertNotesToDb(body.data)
      }
    }
  }

  @Get('/export')
  @Auth()
  @ApiProperty({ description: '导出 Markdown with YAML 数据' })
  @ApiQuery({
    description: '导出的 md 文件名是否为 slug',
    name: 'slug',
    required: false,
    enum: ['0', '1'],
  })
  @HTTPDecorators.Bypass
  async exportArticleToMarkdown(
    @Res() reply: FastifyReply,
    @Query('slug') slug: string,
    @Query('yaml') yaml?: boolean,
    // 是否在第一行显示 文章标题
    @Query('show_title') showTitle?: boolean,
  ) {
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
        type: 'Post',
        permalink: 'posts/' + post.slug,
      }),
    )
    const convertNote = notes.map((note) =>
      convertor(note, {
        mood: note.mood,
        weather: note.weather,
        id: note.nid,
        permalink: 'notes/' + note.nid,
        type: 'Note',
      }),
    )
    const convertPage = pages.map((page) =>
      convertor(page, {
        subtitle: page.subtitle,
        type: 'Page',
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
            slug: !!parseInt(slug),
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

    reply
      .header(
        'Content-Disposition',
        `attachment; filename="markdown-${new Date().toISOString()}.zip"`,
      )
      .type('application/zip')
      .send(readable)
  }

  @Get('/render/:id')
  @CacheTTL(60 * 60 * 24)
  async renderArticle(@Param() params: MongoIdDto, @Res() reply: FastifyReply) {
    const { id } = params
    const now = performance.now()
    const {
      html: markdown,
      document,
      type,
    } = await this.service.renderArticle(id)

    const style = await this.assetService.getAsset('markdown.css', {
      encoding: 'utf8',
    })

    const relativePath = (() => {
      switch (type) {
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
    const url = new URL(relativePath, this.configs.get('url').webUrl)
    reply.type('text/html').send(
      minify(
        `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <meta name="referrer" content="no-referrer">
        <style>
          ${style}
        </style>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mx-space/assets@master/newsprint.css">
        <title>${document.title}</title>
      </head>
      <body>
      <article>
        <h1>${document.title}</h1>
        ${markdown}
        </article>
        </body>
        <footer style="text-align: right; padding: 2em 0;">
        <p>本文渲染于 ${dayjs().format('llll')}，用时 ${
          performance.now() - now
        }ms</p>
        <p>原文地址：<a href="${url}">${decodeURIComponent(
          url.toString(),
        )}</a></p>
        </footer>
      <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
      <link rel="stylesheet"
      href="//cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/default.min.css">
      <script src="//cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/highlight.min.js"></script>
      <script>
      window.mermaid.initialize({
        theme: 'default',
        startOnLoad: false,
      })
      window.mermaid.init(undefined, '.mermaid')

      document.addEventListener('DOMContentLoaded', (event) => {
        document.querySelectorAll('pre code').forEach((el) => {
          hljs.highlightElement(el);
        });
      });
      </script>
      </html>

    `,
        {
          removeAttributeQuotes: true,
          removeComments: true,
          minifyCSS: true,
          minifyJS: true,
          collapseWhitespace: true,
        },
      ),
    )
  }
}
