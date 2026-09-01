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
import { z } from 'zod'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'

import { SayRepository } from './say.repository'

export const SayCreateSchema = z.object({
  text: z.string().min(1),
  source: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
})

type SayCreateBodyDto = z.infer<typeof SayCreateSchema>
export const SayPatchBodySchema = SayCreateSchema.partial()
type SayPatchBodyDto = z.infer<typeof SayPatchBodySchema>

@ApiController('says')
export class SayController {
  constructor(
    @Inject(SayRepository) private readonly repository: SayRepository,
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
  async getOne(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    const row = await this.repository.findById(id)
    if (!row) {
      throw createAppException(AppErrorCode.NOT_FOUND, { id })
    }
    return row
  }

  @Post('/')
  @Auth()
  async create(@Body({ schema: SayCreateSchema }) body: SayCreateBodyDto) {
    return this.repository.create(body)
  }

  @Put('/:id')
  @Auth()
  async update(
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
    @Body({ schema: SayPatchBodySchema }) body: SayPatchBodyDto,
  ) {
    const row = await this.repository.update(id, body)
    if (!row) {
      throw createAppException(AppErrorCode.NOT_FOUND, { id })
    }
    return row
  }

  @Delete('/:id')
  @Auth()
  async remove(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    const row = await this.repository.deleteById(id)
    if (!row) {
      throw createAppException(AppErrorCode.NOT_FOUND, { id })
    }
  }
}
