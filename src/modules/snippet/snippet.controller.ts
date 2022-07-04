import {
  Body,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { BanInDemo } from '~/common/decorator/demo.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { CacheService } from '~/processors/redis/cache.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { SnippetMoreDto } from './snippet.dto'
import { SnippetModel, SnippetType } from './snippet.model'
import { SnippetService } from './snippet.service'

@ApiName
@ApiController('snippets')
export class SnippetController {
  constructor(
    private readonly snippetService: SnippetService,
    private readonly redisService: CacheService,
  ) {}

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

  @Post('/more')
  @Auth()
  async createMore(@Body() body: SnippetMoreDto) {
    const { snippets } = body
    const tasks = snippets.map((snippet) => this.create(snippet))

    await Promise.all(tasks)

    return 'OK'
  }

  @Post('/')
  @Auth()
  @BanInDemo
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
    @IsMaster() isMaster: boolean,
  ) {
    if (typeof name !== 'string') {
      throw new ForbiddenException('name should be string')
    }

    if (typeof reference !== 'string') {
      throw new ForbiddenException('reference should be string')
    }
    let cached: string | null = null
    if (isMaster) {
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

      return json ? json : cached
    }

    const snippet = await this.snippetService.getSnippetByName(name, reference)
    if (snippet.private && !isMaster) {
      throw new ForbiddenException('snippet is private')
    }

    if (snippet.type !== SnippetType.Function) {
      return this.snippetService.attachSnippet(snippet).then((res) => {
        this.snippetService.cacheSnippet(res, res.data)
        return res.data
      })
    }
  }

  @Put('/:id')
  @Auth()
  @BanInDemo
  async update(@Param() param: MongoIdDto, @Body() body: SnippetModel) {
    const { id } = param

    return await this.snippetService.update(id, body)
  }

  @Delete('/:id')
  @Auth()
  @BanInDemo
  async delete(@Param() param: MongoIdDto) {
    const { id } = param
    await this.snippetService.delete(id)
  }
}
