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
import { sample } from 'es-toolkit/compat'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { SayRepository } from './say.repository'

const SayCreateSchema = z.object({
  text: z.string().min(1),
  source: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
})

class SayCreateBodyDto extends createZodDto(SayCreateSchema) {}
class SayPatchBodyDto extends createZodDto(SayCreateSchema.partial()) {}

@ApiController('says')
export class SayController {
  constructor(
    @Inject(SayRepository) private readonly repository: SayRepository,
  ) {}

  @Get('/')
  async gets(@Query() pager: BasicPagerDto) {
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
          totalPages: p.totalPage,
        })
        .build(),
    )
  }

  @Get('/random')
  async getRandomOne() {
    const rows = await this.repository.findAll()
    return rows.length === 0 ? null : sample(rows)
  }

  @Get('/all')
  async getAll() {
    return this.repository.findAll()
  }

  @Get('/:id')
  async getOne(@Param() { id }: EntityIdDto) {
    const row = await this.repository.findById(id)
    if (!row) {
      throw createAppException(AppErrorCode.NOT_FOUND, { id })
    }
    return row
  }

  @Post('/')
  @Auth()
  async create(@Body() body: SayCreateBodyDto) {
    return this.repository.create(body)
  }

  @Put('/:id')
  @Auth()
  async update(@Param() { id }: EntityIdDto, @Body() body: SayPatchBodyDto) {
    const row = await this.repository.update(id, body)
    if (!row) {
      throw createAppException(AppErrorCode.NOT_FOUND, { id })
    }
    return row
  }

  @Delete('/:id')
  @Auth()
  async remove(@Param() { id }: EntityIdDto) {
    const row = await this.repository.deleteById(id)
    if (!row) {
      throw createAppException(AppErrorCode.NOT_FOUND, { id })
    }
  }
}
