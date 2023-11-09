import { FastifyReply } from 'fastify'

import { CacheTTL } from '@nestjs/cache-manager'
import { Get, Inject, Query, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'

import { SyncByLastSyncedAtDto } from './sync.dto'
import { SyncService } from './sync.service'

// Sync api always public
@ApiController('sync')
@Throttle({
  default: {
    ttl: 60,
    limit: 10,
  },
})
export class SyncController {
  @Inject()
  private readonly service: SyncService

  @CacheTTL(2)
  @Get('collection')
  @HTTPDecorators.Bypass
  async fetchAllData(@Res() res: FastifyReply) {
    res.raw.setHeader('Content-Type', 'application/json')
    this.service.buildSyncableData().pipe(res.raw)
  }

  @Get('delta')
  @HTTPDecorators.Bypass
  @CacheTTL(2)
  async syncLastSyncedAt(
    @Query() query: SyncByLastSyncedAtDto,
    @Res() res: FastifyReply,
  ) {
    const { lastSyncedAt } = query

    res.raw.setHeader('Content-Type', 'application/json')
    const readable =
      await this.service.getSyncLastSyncedAtCollection(lastSyncedAt)
    readable.pipe(res.raw)
  }
}
