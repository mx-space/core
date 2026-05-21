import { CacheTTL } from '@nestjs/cache-manager'
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import dayjs from 'dayjs'
import ejs from 'ejs'
import { isNil } from 'es-toolkit/compat'
import xss from 'xss'

import { RequestContext } from '~/common/contexts/request.context'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { CollectionRefTypes } from '~/constants/db.constant'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { getShortDateTime } from '~/utils/time.util'

import { ConfigsService } from '../configs/configs.service'
import { MarkdownPreviewDto } from '../markdown/markdown.schema'
import { MarkdownService } from '../markdown/markdown.service'
import type { NoteModel } from '../note/note.types'
import { OwnerService } from '../owner/owner.service'
import type { PageModel } from '../page/page.types'
import type { PostModel } from '../post/post.types'

@Controller('/render')
export class RenderEjsController {
  constructor(
    private readonly service: MarkdownService,
    private readonly configs: ConfigsService,
    private readonly ownerService: OwnerService,
  ) {}

  @Get('/markdown/:id')
  @RawResponse
  @Header('content-type', 'text/html')
  @CacheTTL(60 * 60)
  async renderArticle(
    @Param() params: EntityIdDto,
    @Query('theme') theme: string,
  ) {
    const { id } = params
    const hasAdminAccess = RequestContext.hasAdminAccess()
    const now = performance.now()
    const [
      { html: markdownMacros, document, type },
      {
        url: { webUrl },
      },
      { name: username },
    ] = await Promise.all([
      this.service.renderArticle(id),
      this.configs.waitForConfigReady(),
      this.ownerService.getOwner(),
    ])

    const isPrivateOrEncrypt =
      ('isPublished' in document && !document.isPublished) ||
      ('password' in document && !isNil(document.password))

    if (!hasAdminAccess && isPrivateOrEncrypt) {
      throw createAppException(AppErrorCode.POST_HIDDEN_OR_ENCRYPTED)
    }

    const relativePath = (() => {
      switch (type) {
        case CollectionRefTypes.Post: {
          return `/posts/${((document as PostModel).category as any).slug}/${
            (document as PostModel).slug
          }`
        }
        case CollectionRefTypes.Note: {
          return `/notes/${(document as NoteModel).nid}`
        }
        case CollectionRefTypes.Page: {
          return `/${(document as PageModel).slug}`
        }
      }
    })()

    const url = new URL(relativePath!, webUrl)

    const structure = await this.service.getRenderedMarkdownHtmlStructure(
      markdownMacros,
      document.title,
      theme,
    )

    const html = ejs.render(await this.service.getMarkdownEjsRenderTemplate(), {
      ...structure,
      info: isPrivateOrEncrypt ? '正在查看的文章还未公开' : undefined,

      title: document.title,
      footer: `<div>本文渲染于 ${getShortDateTime(
        new Date(),
      )}，由 marked.js 解析生成，用时 ${(performance.now() - now).toFixed(
        2,
      )}ms</div>
      <div>作者：${username}，撰写于${dayjs(document.createdAt).format(
        'llll',
      )}</div>
        <div>原文地址：<a href="${url}">${decodeURIComponent(
          url.toString(),
        )}</a></div>
        `,
    })

    return html.trim()
  }

  @Post('/markdown')
  @RawResponse
  @HttpCache.disable
  @Auth()
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
      theme,
    )
    return ejs
      .render(await this.service.getMarkdownEjsRenderTemplate(), {
        ...structure,

        title: xss(title),
      })
      .trim()
  }
}
