import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { SnippetDto, SnippetMoreDto } from './snippet.schema'
import { SnippetService } from './snippet.service'

@ApiController('snippets')
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Get('/')
  @Auth()
  async getList(@Query() query: PagerDto) {
    const { page, size } = query
    return this.snippetService.repository.list(page, size)
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

  @Get('/:id')
  @Auth()
  async getSnippetById(@Param() param: EntityIdDto) {
    return this.snippetService.getSnippetById(param.id)
  }

  @Get('/group')
  @Auth()
  async getGroup(@Query() query: PagerDto) {
    const { page, size = 30 } = query
    return this.snippetService.repository.listGrouped(page, size)
  }

  @Get('/group/:reference')
  @Auth()
  async getGroupByReference(@Param('reference') reference: string) {
    if (typeof reference !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidReference)
    }

    return this.snippetService.repository.findAll(reference)
  }

  @Post('/aggregate')
  @Auth()
  async aggregate() {
    throw new BizException(
      ErrorCodeEnum.InvalidParameter,
      'POST /snippets/aggregate is removed in PostgreSQL mode. Use GET /snippets/group or /snippets/group/:reference instead.',
    )
  }

  @Get('/:reference/:name')
  @HTTPDecorators.Bypass
  async getSnippetByName(
    @Param('name') name: string,
    @Param('reference') reference: string,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    if (typeof name !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidName)
    }

    if (typeof reference !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidReference)
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
