import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common'

import { Auth } from '~/common/decorator/auth.decorator'
import { Paginator } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { PageQueryDto } from './page.dto'
import { PageModel, PartialPageModel } from './page.model'
import { PageService } from './page.service'

@Controller('pages')
@ApiName
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Get('/')
  @Paginator
  async getPagesSummary(@Query() query: PageQueryDto) {
    const { size, select, page, sortBy, sortOrder } = query

    return await this.pageService.model.paginate(
      {},
      {
        limit: size,
        page,
        select,
        sort: sortBy
          ? { [sortBy]: sortOrder || -1 }
          : { order: -1, modified: -1 },
      },
    )
  }

  @Get('/:id')
  async getPageById(@Param() params: MongoIdDto) {
    const page = this.pageService.model.findById(params.id).lean()
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
      .lean()

    if (!page) {
      throw new CannotFindException()
    }
    return page
  }

  @Post('/')
  @Auth()
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
  @HttpCode(204)
  async patch(@Body() body: PartialPageModel, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body)

    return
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async deletePage(@Param() params: MongoIdDto) {
    await this.pageService.model.deleteOne({
      _id: params.id,
    })
    return
  }
}
