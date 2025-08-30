import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { PageReorderDto } from './page.dto'
import { PageModel, PartialPageModel } from './page.model'
import { PageService } from './page.service'

@ApiController('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly macroService: TextMacroService,
  ) {}

  @Get('/')
  @Paginator
  async getPagesSummary(@Query() query: PagerDto) {
    const { size, select, page, sortBy, sortOrder } = query

    return await this.pageService.model.paginate(
      {},
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { order: -1 },
      },
    )
  }

  @Get('/:id')
  @Auth()
  async getPageById(@Param() params: MongoIdDto) {
    const page = this.pageService.model
      .findById(params.id)
      .lean({ getters: true })
    if (!page) {
      throw new CannotFindException()
    }
    return page
  }

  @Get('/slug/:slug')
  async getPageBySlug(@Param('slug') slug: string) {
    if (typeof slug !== 'string') {
      throw new UnprocessableEntityException('slug must be string')
    }
    const page = await this.pageService.model
      .findOne({
        slug,
      })
      .lean({ getters: true })

    if (!page) {
      throw new CannotFindException()
    }

    page.text = await this.macroService.replaceTextMacro(page.text, page)

    return page
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PageModel) {
    return await this.pageService.create(body)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: PageModel, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body)

    return await this.pageService.model.findById(id).lean()
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialPageModel, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body)

    return
  }

  @Patch('/reorder')
  @Auth()
  async reorder(@Body() body: PageReorderDto) {
    const { seq } = body
    const orders = seq.map(($) => $.order)
    const uniq = new Set(orders)
    if (uniq.size !== orders.length) {
      throw new UnprocessableEntityException('order must be unique')
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
