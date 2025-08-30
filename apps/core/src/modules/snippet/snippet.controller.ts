import {
  Body,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { SnippetMoreDto } from './snippet.dto'
import { SnippetModel } from './snippet.model'
import { SnippetService } from './snippet.service'

@ApiController('snippets')
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Get('/')
  @Auth()
  async getList(@Query() query: PagerDto) {
    const { page, size, select = '', db_query } = query

    return transformDataToPaginate(
      await this.snippetService.model.paginate(db_query ?? {}, {
        page,
        limit: size,
        select,
        sort: {
          reference: 1,
          created: -1,
        },
      }),
    )
  }

  @Post('/import')
  @Auth()
  async importSnippets(@Body() body: SnippetMoreDto) {
    const { snippets } = body
    const tasks = snippets.map((snippet) => this.create(snippet))

    await Promise.all(tasks)

    return 'OK'
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: SnippetModel) {
    return await this.snippetService.create(body)
  }

  @Get('/:id')
  @Auth()
  async getSnippetById(@Param() param: MongoIdDto) {
    const { id } = param
    const snippet = await this.snippetService.getSnippetById(id)

    return snippet
  }

  @Get('/group')
  @Auth()
  @HTTPDecorators.Paginator
  async getGroup(@Query() query: PagerDto) {
    const { page, size = 30 } = query
    return this.snippetService.model.aggregatePaginate(
      this.snippetService.model.aggregate([
        {
          $group: {
            _id: {
              reference: '$reference',
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            '_id.reference': 1,
          },
        },
        {
          $project: {
            _id: 0,
            reference: '$_id.reference',
            count: 1,
          },
        },
      ]),
      {
        page,
        limit: size,
      },
    )
  }

  @Get('/group/:reference')
  @Auth()
  async getGroupByReference(@Param('reference') reference: string) {
    if (typeof reference !== 'string') {
      throw new UnprocessableEntityException('reference should be string')
    }

    return this.snippetService.model.find({ reference }).lean()
  }

  @Post('/aggregate')
  @Auth()
  async aggregate(@Body() body: any) {
    return this.snippetService.model.aggregate(body)
  }

  @Get('/:reference/:name')
  @HTTPDecorators.Bypass
  async getSnippetByName(
    @Param('name') name: string,
    @Param('reference') reference: string,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    if (typeof name !== 'string') {
      throw new ForbiddenException('name should be string')
    }

    if (typeof reference !== 'string') {
      throw new ForbiddenException('reference should be string')
    }
    let cached: string | null = null
    if (isAuthenticated) {
      cached =
        (
          await Promise.all(
            (['public', 'private'] as const).map((type) => {
              return this.snippetService.getCachedSnippet(reference, name, type)
            }),
          )
        ).find(Boolean) || null
    } else {
      cached = await this.snippetService.getCachedSnippet(
        reference,
        name,
        'public',
      )
    }

    if (cached) {
      const json = JSON.safeParse(cached)

      return json || cached
    }

    return await this.snippetService.getPublicSnippetByName(name, reference)
  }

  @Put('/:id')
  @Auth()
  async update(@Param() param: MongoIdDto, @Body() body: SnippetModel) {
    const { id } = param

    return await this.snippetService.update(id, body)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() param: MongoIdDto) {
    const { id } = param
    await this.snippetService.delete(id)
  }
}
