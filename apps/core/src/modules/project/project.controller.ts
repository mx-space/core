import {
  Body,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { type BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'

import {
  type ProjectCreateDto,
  ProjectCreateSchema,
  type ProjectPatchDto,
  ProjectPatchSchema,
} from './project.dto'
import { ProjectRepository } from './project.repository'

@ApiController('projects')
export class ProjectController {
  constructor(
    @Inject(ProjectRepository) private readonly repository: ProjectRepository,
  ) {}

  @Get('/')
  async gets(@Query({ schema: BasicPagerSchema }) pager: BasicPagerDto) {
    const size = pager.size ?? 10
    const page = pager.page ?? 1
    const result = await this.repository.list(page, size)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Get('/all')
  async getAll() {
    return this.repository.findAll()
  }

  @Get('/:id')
  async get(@Param({ schema: EntityIdSchema }) param: EntityIdDto) {
    const row = await this.repository.findById(param.id)
    if (!row) {
      throw createAppException(AppErrorCode.PROJECT_NOT_FOUND, { id: param.id })
    }
    return row
  }

  @Post('/')
  @Auth()
  async create(@Body({ schema: ProjectCreateSchema }) body: ProjectCreateDto) {
    return this.repository.create(body)
  }

  @Patch('/:id')
  @Auth()
  async patch(
    @Body({ schema: ProjectPatchSchema }) body: ProjectPatchDto,
    @Param({ schema: EntityIdSchema }) param: EntityIdDto,
  ) {
    const updated = await this.repository.update(param.id, body)
    if (!updated) {
      throw createAppException(AppErrorCode.PROJECT_NOT_FOUND, { id: param.id })
    }
    return updated
  }

  @Put('/:id')
  @Auth()
  async update(
    @Body({ schema: ProjectPatchSchema }) body: ProjectPatchDto,
    @Param({ schema: EntityIdSchema }) param: EntityIdDto,
  ) {
    return this.patch(body, param)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param({ schema: EntityIdSchema }) param: EntityIdDto) {
    const removed = await this.repository.deleteById(param.id)
    if (!removed) {
      throw createAppException(AppErrorCode.PROJECT_NOT_FOUND, { id: param.id })
    }
    return removed
  }
}
