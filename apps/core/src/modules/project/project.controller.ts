import {
  Body,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { ProjectRepository } from './project.repository'

@ApiController('projects')
@ResponseV2()
export class ProjectController {
  constructor(
    @Inject(ProjectRepository) private readonly repository: ProjectRepository,
  ) {}

  @Get('/')
  async gets(@Query() pager: PagerDto) {
    const size = pager.size ?? 10
    const page = pager.page ?? 1
    const result = await this.repository.list(page, size)
    const p = result.pagination
    return withMeta(
      result.data,
      new MetaObjectBuilder()
        .pagination({
          page: p.currentPage,
          size: p.size,
          total: p.total,
          total_pages: p.totalPage,
        })
        .build(),
    )
  }

  @Get('/all')
  async getAll() {
    return this.repository.findAll()
  }

  @Get('/:id')
  async get(@Param() param: EntityIdDto) {
    return this.repository.findById(param.id)
  }

  @Post('/')
  @Auth()
  async create(@Body() body: any) {
    return this.repository.create(body)
  }

  @Put('/:id')
  @Auth()
  async update(@Body() body: any, @Param() param: EntityIdDto) {
    return this.repository.update(param.id, body)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() param: EntityIdDto) {
    return this.repository.deleteById(param.id)
  }
}
