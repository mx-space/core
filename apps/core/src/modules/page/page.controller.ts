import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import {
  type ArticleTranslationInput,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { applyContentPreference } from '~/utils/content.util'

import { PageModel } from './page.model'
import {
  PageDetailQueryDto,
  PageDto,
  PageReorderDto,
  PartialPageDto,
} from './page.schema'
import { PageService } from './page.service'

@ApiController('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly translationService: TranslationService,
  ) {}

  @Get('/')
  @Paginator
  async getPagesSummary(@Query() query: PagerDto, @Lang() lang?: string) {
    const { size, select, page, sortBy, sortOrder } = query

    const result = await this.pageService.model.paginate(
      {},
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { order: -1 },
      },
    )

    if (!lang || !result.docs.length) {
      return result
    }

    const translationInputs: ArticleTranslationInput[] = []
    for (const doc of result.docs) {
      const originalText = doc.text
      if (doc.meta && typeof doc.meta === 'string') {
        doc.meta = JSON.safeParse(doc.meta as string) || doc.meta
      }
      if (typeof originalText === 'string') {
        translationInputs.push({
          id: doc._id?.toString?.() ?? doc.id ?? String(doc._id),
          title: doc.title,
          text: originalText,
          subtitle: doc.subtitle,
          meta: doc.meta as { lang?: string } | undefined,
          contentFormat: doc.contentFormat,
          content: doc.content,
          modified: doc.modified,
          created: doc.created,
        })
      }
    }

    if (translationInputs.length) {
      const translationResults =
        await this.translationService.translateArticleList({
          articles: translationInputs,
          targetLang: lang,
        })

      result.docs = result.docs.map((doc) => {
        const docId = doc._id?.toString?.() ?? doc.id ?? String(doc._id)
        const translation = translationResults.get(docId)
        if (!translation?.isTranslated) {
          return doc
        }
        doc.title = translation.title
        doc.text = translation.text
        doc.subtitle = translation.subtitle
        ;(doc as { isTranslated?: boolean }).isTranslated =
          translation.isTranslated
        ;(doc as { translationMeta?: unknown }).translationMeta =
          translation.translationMeta
        return doc
      })
    }

    return result
  }

  @Get('/:id')
  @Auth()
  async getPageById(@Param() params: MongoIdDto) {
    const page = await this.pageService.model
      .findById(params.id)
      .lean({ getters: true })
    if (!page) {
      throw new CannotFindException()
    }
    return page
  }

  @Get('/slug/:slug')
  async getPageBySlug(
    @Param('slug') slug: string,
    @Query() query: PageDetailQueryDto,
    @Lang() lang?: string,
  ) {
    if (typeof slug !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidSlug)
    }
    const page = await this.pageService.model
      .findOne({
        slug,
      })
      .lean({ getters: true })

    if (!page) {
      throw new CannotFindException()
    }

    // 检查密码保护
    if (!this.pageService.checkPasswordToAccess(page, query.password)) {
      throw new BizException(ErrorCodeEnum.PostNotFound)
    }

    const translationResult = await this.translationService.translateArticle({
      articleId: page._id?.toString?.() ?? page.id ?? String(page._id),
      targetLang: lang,
      allowHidden: Boolean(page.password),
      originalData: {
        title: page.title,
        text: page.text,
        subtitle: page.subtitle,
      },
    })

    const resultData = applyContentPreference(
      {
        ...page,
        title: translationResult.title,
        text: translationResult.text,
        subtitle: translationResult.subtitle,
        ...(translationResult.content && {
          content: translationResult.content,
          contentFormat: translationResult.contentFormat,
        }),
        isTranslated: translationResult.isTranslated,
        translationMeta: translationResult.translationMeta,
        availableTranslations: translationResult.availableTranslations,
      },
      query.prefer,
    )

    // 如果有密码，将其替换为 '*'
    if (resultData.password) {
      resultData.password = '*'
    }

    return resultData
  }

  @Get('/slug/:slug/password-hint')
  async getPasswordHint(@Param('slug') slug: string) {
    if (typeof slug !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidSlug)
    }
    const page = await this.pageService.model
      .findOne({ slug })
      .lean({ getters: true })

    if (!page) {
      throw new CannotFindException()
    }

    // 只返回密码提示，不返回其他内容
    return {
      hasPassword: !!page.password,
      passwordHint: page.passwordHint,
    }
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PageDto) {
    return await this.pageService.create(body as unknown as PageModel)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: PageDto, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as PageModel)

    return await this.pageService.model.findById(id).lean()
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialPageDto, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as Partial<PageModel>)

    return
  }

  @Patch('/reorder')
  @Auth()
  async reorder(@Body() body: PageReorderDto) {
    const { seq } = body
    const orders = seq.map(($) => $.order)
    const uniq = new Set(orders)
    if (uniq.size !== orders.length) {
      throw new BizException(ErrorCodeEnum.InvalidOrderValue)
    }
    const tasks = seq.map(({ id, order }) => {
      return this.pageService.model.updateOne(
        {
          _id: id,
        },
        {
          order,
        },
      )
    })
    await Promise.all(tasks)
  }

  @Delete('/:id')
  @Auth()
  async deletePage(@Param() params: MongoIdDto) {
    await this.pageService.deleteById(params.id)
    return
  }
}
