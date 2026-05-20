import { Body, Get, Patch, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { StringIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { ReaderService } from './reader.service'

@ApiController('readers')
@Auth()
@ResponseV2()
export class ReaderAuthController {
  constructor(private readonly readerService: ReaderService) {}

  @Get('/')
  async find(@Query() query: PagerDto) {
    const { page = 1, size = 20 } = query
    const result = await this.readerService.findPaginated(page, size)
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

  @Patch('/transfer-owner')
  async transferOwner(@Body() body: StringIdDto) {
    return this.readerService.transferOwner(body.id)
  }

  @Patch('/revoke-owner')
  async revokeOwner(@Body() body: StringIdDto) {
    return this.readerService.revokeOwner(body.id)
  }
}
