import { Body, Get, Param, Patch, Query } from '@nestjs/common'
import { z } from 'zod'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { type StringIdDto, StringIdSchema } from '~/shared/dto/id.dto'

import { ReaderService } from './reader.service'

export const ReaderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  role: z.enum(['all', 'owner', 'reader']).optional(),
  membershipStatus: z
    .enum(['active', 'on_hold', 'cancelled', 'expired', 'none'])
    .optional(),
})

type ReaderListQueryDto = z.infer<typeof ReaderListQuerySchema>

export const ReaderBanSchema = z.object({
  reason: z.string().trim().optional(),
})

type ReaderBanDto = z.infer<typeof ReaderBanSchema>

@ApiController('readers')
@Auth()
export class ReaderAuthController {
  constructor(private readonly readerService: ReaderService) {}

  @Get('/')
  async find(
    @Query({ schema: ReaderListQuerySchema }) query: ReaderListQueryDto,
  ) {
    const { page = 1, size = 20, search, role, membershipStatus } = query
    const result = await this.readerService.findPaginated(
      page,
      size,
      search,
      role,
      membershipStatus,
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
  async transferOwner(@Body({ schema: StringIdSchema }) body: StringIdDto) {
    return this.readerService.transferOwner(body.id)
  }

  @Patch('/revoke-owner')
  async revokeOwner(@Body({ schema: StringIdSchema }) body: StringIdDto) {
    return this.readerService.revokeOwner(body.id)
  }

  @Patch('/:id/ban')
  async ban(
    @Param('id') id: string,
    @Body({ schema: ReaderBanSchema }) body: ReaderBanDto,
  ) {
    return this.readerService.banReader(id, body.reason)
  }

  @Patch('/:id/unban')
  async unban(@Param('id') id: string) {
    return this.readerService.unbanReader(id)
  }
}
