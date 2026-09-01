import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'

import {
  SnippetByPathDto,
  SnippetByPathSchema,
  SnippetDto,
  SnippetListDto,
  SnippetListSchema,
  SnippetMoreDto,
  SnippetMoreSchema,
  SnippetMoveDto,
  SnippetMoveSchema,
  SnippetSchema,
} from './snippet.schema'
import { SnippetService } from './snippet.service'

@ApiController('snippets')
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Get('/')
  @Auth()
  async getList(@Query({ schema: SnippetListSchema }) query: SnippetListDto) {
    const { prefix, recursive, limit } = query
    return this.snippetService.listVfs({ prefix, recursive, limit })
  }

  @Get('/by-path')
  @Auth()
  async getSnippetByPath(
    @Query({ schema: SnippetByPathSchema }) query: SnippetByPathDto,
  ) {
    const row = await this.snippetService.repository.findAnyByPath(query.path)
    if (!row) return null
    return this.snippetService.transformLeanSnippet(row)
  }

  @Put('/by-path')
  @Auth()
  @HTTPDecorators.Idempotence()
  async upsertByPath(@Body({ schema: SnippetSchema }) body: SnippetDto) {
    return await this.snippetService.upsertByPath(body as any)
  }

  @Delete('/by-path')
  @Auth()
  async deleteByPath(
    @Query({ schema: SnippetByPathSchema }) query: SnippetByPathDto,
  ) {
    await this.snippetService.deleteByPath(query.path, query.recursive ?? false)
  }

  @Post('/move')
  @HttpCode(200)
  @Auth()
  async move(@Body({ schema: SnippetMoveSchema }) body: SnippetMoveDto) {
    return this.snippetService.movePath(
      body.from,
      body.to,
      body.recursive ?? false,
    )
  }

  @Post('/import')
  @Auth()
  async importSnippets(
    @Body({ schema: SnippetMoreSchema }) body: SnippetMoreDto,
  ) {
    return this.snippetService.importSnippets(body.snippets as any)
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body({ schema: SnippetSchema }) body: SnippetDto) {
    return await this.snippetService.create(body as any)
  }

  @Get('/:id')
  @Auth()
  async getSnippetById(@Param({ schema: EntityIdSchema }) param: EntityIdDto) {
    return this.snippetService.getSnippetById(param.id)
  }

  @Put('/:id')
  @Auth()
  async update(
    @Param({ schema: EntityIdSchema }) param: EntityIdDto,
    @Body({ schema: SnippetSchema }) body: SnippetDto,
  ) {
    return await this.snippetService.update(param.id, body as any)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param({ schema: EntityIdSchema }) param: EntityIdDto) {
    await this.snippetService.delete(param.id)
  }
}
