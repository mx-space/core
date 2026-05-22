import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { SnippetDto, SnippetMoreDto } from './snippet.schema'
import { SnippetService } from './snippet.service'

@ApiController('snippets')
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Get('/')
  @Auth()
  async getList(@Query() query: BasicPagerDto) {
    const { page, size } = query
    const result = await this.snippetService.repository.list(page, size)
    const { pagination } = result
    return withMeta(
      this.snippetService.transformLeanSnippetList(result.data),
      new MetaObjectBuilder()
        .pagination({
          page: pagination.currentPage,
          size: pagination.size,
          total: pagination.total,
          totalPages: pagination.totalPage,
        })
        .build(),
    )
  }

  @Post('/import')
  @Auth()
  async importSnippets(@Body() body: SnippetMoreDto) {
    const { snippets } = body
    const tasks = snippets.map((snippet) =>
      this.snippetService.create(snippet as any),
    )

    await Promise.all(tasks)

    return 'OK'
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: SnippetDto) {
    return await this.snippetService.create(body as any)
  }

  @Get('/group')
  @Auth()
  async getGroup(@Query() query: BasicPagerDto) {
    const { page, size = 30 } = query
    const result = await this.snippetService.repository.listGrouped(page, size)
    const { pagination } = result
    return withMeta(
      result.data,
      new MetaObjectBuilder()
        .pagination({
          page: pagination.currentPage,
          size: pagination.size,
          total: pagination.total,
          totalPages: pagination.totalPage,
        })
        .build(),
    )
  }

  @Get('/group/:reference')
  @Auth()
  async getGroupByReference(@Param('reference') reference: string) {
    if (typeof reference !== 'string') {
      throw createAppException(AppErrorCode.INVALID_REFERENCE)
    }

    const rows = await this.snippetService.repository.findAll(reference)
    return this.snippetService.transformLeanSnippetList(rows)
  }

  @Get('/:id')
  @Auth()
  async getSnippetById(@Param() param: EntityIdDto) {
    return this.snippetService.getSnippetById(param.id)
  }

  @Post('/aggregate')
  @Auth()
  async aggregate() {
    throw createAppException(AppErrorCode.INVALID_PARAMETER, {
      message:
        'POST /snippets/aggregate is removed in PostgreSQL mode. Use GET /snippets/group or /snippets/group/:reference instead.',
    })
  }

  @Get('/:reference/:name')
  @HTTPDecorators.RawResponse
  async getSnippetByName(
    @Param('name') name: string,
    @Param('reference') reference: string,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    if (typeof name !== 'string') {
      throw createAppException(AppErrorCode.INVALID_NAME)
    }

    if (typeof reference !== 'string') {
      throw createAppException(AppErrorCode.INVALID_REFERENCE)
    }
    const cached = hasAdminAccess
      ? (
          await Promise.all(
            (['public', 'private'] as const).map((type) =>
              this.snippetService.getCachedSnippet(reference, name, type),
            ),
          )
        ).find(Boolean) || null
      : await this.snippetService.getCachedSnippet(reference, name, 'public')

    if (cached) {
      const json = JSON.safeParse(cached)

      return json || cached
    }

    return await this.snippetService.getPublicSnippetByName(name, reference)
  }

  @Put('/:id')
  @Auth()
  async update(@Param() param: EntityIdDto, @Body() body: SnippetDto) {
    const { id } = param

    return await this.snippetService.update(id, body as any)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() param: EntityIdDto) {
    const { id } = param
    await this.snippetService.delete(id)
  }
}
