import { Body, Get, Param, Patch, Query } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { StringIdDto } from '~/shared/dto/id.dto'

import { ReaderService } from './reader.service'

const ReaderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  role: z.enum(['all', 'owner', 'reader']).optional(),
})

class ReaderListQueryDto extends createZodDto(ReaderListQuerySchema) {}

const ReaderBanSchema = z.object({
  reason: z.string().trim().optional(),
})

class ReaderBanDto extends createZodDto(ReaderBanSchema) {}

@ApiController('readers')
@Auth()
export class ReaderAuthController {
  constructor(private readonly readerService: ReaderService) {}

  @Get('/')
  async find(@Query() query: ReaderListQueryDto) {
    const { page = 1, size = 20, search, role } = query
    const result = await this.readerService.findPaginated(
      page,
      size,
      search,
      role,
    )
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Get('/stats')
  async stats() {
    return this.readerService.getStats()
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return this.readerService.getById(id)
  }

  @Patch('/transfer-owner')
  async transferOwner(@Body() body: StringIdDto) {
    return this.readerService.transferOwner(body.id)
  }

  @Patch('/revoke-owner')
  async revokeOwner(@Body() body: StringIdDto) {
    return this.readerService.revokeOwner(body.id)
  }

  @Patch('/:id/ban')
  async ban(@Param('id') id: string, @Body() body: ReaderBanDto) {
    return this.readerService.banReader(id, body.reason)
  }

  @Patch('/:id/unban')
  async unban(@Param('id') id: string) {
    return this.readerService.unbanReader(id)
  }
}
