/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { join } from 'path'
import { Readable } from 'stream'
import JSZip from 'jszip'

import { Body, CacheTTL, Get, Header, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { CategoryModel } from '../category/category.model'
import { DataListDto, ExportMarkdownQueryDto } from './markdown.dto'
import { MarkdownYAMLProperty } from './markdown.interface'
import { MarkdownService } from './markdown.service'

@ApiController('markdown')
export class MarkdownController {
  constructor(private readonly service: MarkdownService) {}

  @Post('/import')
  @Auth()
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
        modified?: Date | null
        title: string
        slug?: string
      },
    >(
      item: T,
      extraMetaData: Record<string, any> = {},
    ): MarkdownYAMLProperty => {
      const meta = {
        created: item.created!,
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
      convertor(post!, {
        categories: (post.category as CategoryModel).name,
        type: 'post',
        permalink: `posts/${post.slug}`,
      }),
    )
    const convertNote = notes.map((note) =>
      convertor(note!, {
        mood: note.mood,
        weather: note.weather,
        id: note.nid,
        permalink: `notes/${note.nid}`,
        type: 'note',
        slug: note.nid.toString(),
      }),
    )
    const convertPage = pages.map((page) =>
      convertor(page!, {
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

  @Get('/render/structure/:id')
  @CacheTTL(60 * 60)
  async getRenderedMarkdownHtmlStructure(@Param() params: MongoIdDto) {
    const { id } = params
    const { html, document } = await this.service.renderArticle(id)

    return this.service.getRenderedMarkdownHtmlStructure(html, document.title)
  }
}
