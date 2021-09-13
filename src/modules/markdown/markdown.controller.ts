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
import JSZip from 'jszip'
import { join } from 'path'
import { Readable } from 'stream'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { AssetService } from '~/processors/helper/hepler.asset.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { CategoryModel } from '../category/category.model'
import { ArticleType, DataListDto } from './markdown.dto'
import { MarkdownYAMLProperty } from './markdown.interface'
import { MarkdownService } from './markdown.service'

@Controller('markdown')
@ApiName
export class MarkdownController {
  constructor(
    private readonly service: MarkdownService,

    private readonly assetService: AssetService,
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
    const { html: markdown, document } = await this.service.renderArticle(id)

    const style = await this.assetService.getAsset('markdown.css', {
      encoding: 'utf8',
    })

    reply.type('text/html').send(
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
        <p>本文渲染于 ${dayjs().format('DD/MM/YYYY')}</p>
        ${markdown}
        </article>
      </body>
      <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
      <script>
      window.mermaid.initialize({
        theme: 'default',
        startOnLoad: false,
      })
      window.mermaid.init(undefined, '.mermaid')
      </script>
      </html>

    `
        .split('\n')
        .map((line) => line.trim())
        .join('\n'),
    )
  }
}
