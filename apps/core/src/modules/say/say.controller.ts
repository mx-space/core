import { Get, Inject, Query } from '@nestjs/common'
import { sample } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { SayRepository } from './say.repository'

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
          total_pages: p.totalPage,
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
}
