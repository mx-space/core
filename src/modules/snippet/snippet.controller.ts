import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { DATA_DIR } from '~/constants/path.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { installPKG } from '~/utils'

import { SnippetMoreDto } from './snippet.dto'
import { SnippetModel, SnippetType } from './snippet.model'
import { SnippetService } from './snippet.service'

@ApiName
@Controller('snippets')
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

  @Post('/more')
  @Auth()
  async createMore(@Body() body: SnippetMoreDto) {
    const { snippets, packages = [] } = body
    const tasks = snippets.map((snippet) => this.create(snippet))

    const resultList = await Promise.all(tasks)

    try {
      if (packages.length) {
        const tasks2 = packages.map((pkg) => {
          return installPKG(pkg, DATA_DIR)
        })
        await Promise.all(tasks2)
      }
    } catch (err) {
      await Promise.all(
        resultList.map((doc) => {
          return doc.remove()
        }),
      )
      throw err
    }
  }

  @Post('/')
  @Auth()
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
