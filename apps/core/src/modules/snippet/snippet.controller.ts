import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { EntityIdDto } from '~/shared/dto/id.dto'

import {
  SnippetByPathDto,
  SnippetDto,
  SnippetListDto,
  SnippetMoreDto,
  SnippetMoveDto,
} from './snippet.schema'
import { SnippetService } from './snippet.service'

@ApiController('snippets')
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Get('/')
  @Auth()
  async getList(@Query() query: SnippetListDto) {
    const { prefix, recursive, limit } = query
    return this.snippetService.listVfs({ prefix, recursive, limit })
  }

  @Get('/by-path')
  @Auth()
  async getSnippetByPath(@Query() query: SnippetByPathDto) {
    const row = await this.snippetService.repository.findAnyByPath(query.path)
    if (!row) return null
    return this.snippetService.transformLeanSnippet(row)
  }

  @Put('/by-path')
  @Auth()
  @HTTPDecorators.Idempotence()
  async upsertByPath(@Body() body: SnippetDto) {
    return await this.snippetService.upsertByPath(body as any)
  }

  @Delete('/by-path')
  @Auth()
  async deleteByPath(@Query() query: SnippetByPathDto) {
    await this.snippetService.deleteByPath(query.path, query.recursive ?? false)
  }

  @Post('/move')
  @Auth()
  async move(@Body() body: SnippetMoveDto) {
    return this.snippetService.movePath(
      body.from,
      body.to,
      body.recursive ?? false,
    )
  }

  @Post('/import')
  @Auth()
  async importSnippets(@Body() body: SnippetMoreDto) {
    const { snippets } = body
    await Promise.all(
      snippets.map((snippet) => this.snippetService.create(snippet as any)),
    )
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

  @Put('/:id')
  @Auth()
  async update(@Param() param: EntityIdDto, @Body() body: SnippetDto) {
    return await this.snippetService.update(param.id, body as any)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() param: EntityIdDto) {
    await this.snippetService.delete(param.id)
  }
}
