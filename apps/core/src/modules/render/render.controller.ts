import { CacheTTL } from '@nestjs/cache-manager'
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { getShortDateTime } from '~/utils/time.util'
import dayjs from 'dayjs'
import { render } from 'ejs'
import { isNil } from 'lodash'
import xss from 'xss'
import { ConfigsService } from '../configs/configs.service'
import { MarkdownPreviewDto } from '../markdown/markdown.dto'
import { MarkdownService } from '../markdown/markdown.service'
import type { NoteModel } from '../note/note.model'
import type { PageModel } from '../page/page.model'
import type { PostModel } from '../post/post.model'
import { UserService } from '../user/user.service'

@Controller('/render')
@HTTPDecorators.Bypass
export class RenderEjsController {
  constructor(
    private readonly service: MarkdownService,
    private readonly configs: ConfigsService,
    private readonly userService: UserService,
  ) {}

  @Get('/markdown/:id')
  @Header('content-type', 'text/html')
  @CacheTTL(60 * 60)
  async renderArticle(
    @Param() params: MongoIdDto,
    @Query('theme') theme: string,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { id } = params
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
      this.userService.getMaster(),
    ])

    const isPrivateOrEncrypt =
      ('isPublished' in document && !document.isPublished) ||
      ('password' in document && !isNil(document.password))

    if (!isAuthenticated && isPrivateOrEncrypt) {
      throw new ForbiddenException('该文章已隐藏或加密')
    }

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

    const url = new URL(relativePath!, webUrl)

    const structure = await this.service.getRenderedMarkdownHtmlStructure(
      markdownMacros,
      document.title,
      theme,
    )

    const html = render(await this.service.getMarkdownEjsRenderTemplate(), {
      ...structure,
      info: isPrivateOrEncrypt ? '正在查看的文章还未公开' : undefined,

      title: document.title,
      footer: `<div>本文渲染于 ${getShortDateTime(
        new Date(),
      )}，由 marked.js 解析生成，用时 ${(performance.now() - now).toFixed(
        2,
      )}ms</div>
      <div>作者：${username}，撰写于${dayjs(document.created).format(
        'llll',
      )}</div>
        <div>原文地址：<a href="${url}">${decodeURIComponent(
          url.toString(),
        )}</a></div>
        `,
    })

    return html.trim()
  }

  /**
   * 后台预览 Markdown 可用接口，传入 `title` 和 `md`
   */
  @Post('/markdown')
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
    return render(await this.service.getMarkdownEjsRenderTemplate(), {
      ...structure,

      title: xss(title),
    }).trim()
  }
}
