import { CacheTTL } from '@nestjs/cache-manager'
import { Get, Header, Inject, Query, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { FastifyReply } from 'fastify'
import { SyncByLastSyncedAtDto, SyncDataChecksumDto } from './sync.dto'
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

  @Get('collection')
  @HTTPDecorators.Bypass
  async fetchAllData(@Res() res: FastifyReply) {
    res.raw.setHeader('Content-Type', 'application/json')
    res.send(this.service.buildSyncableData())
  }

  @Get('delta')
  @HTTPDecorators.Bypass
  async syncLastSyncedAt(
    @Query() query: SyncByLastSyncedAtDto,
    @Res() res: FastifyReply,
  ) {
    const { lastSyncedAt } = query

    res.raw.setHeader('Content-Type', 'application/json')
    const readable = await this.service.getSyncLastSyncedAt(lastSyncedAt)

    res.send(readable)
  }

  @Get('item')
  @CacheTTL(2)
  @HTTPDecorators.Bypass
  @Header('content-type', 'text/plain')
  async getItem(@Query() query: SyncDataChecksumDto) {
    const { id, type } = query

    return await this.service
      .findByIds(type, [id])
      .then((docs) => {
        if (docs.length === 0) {
          return null
        }

        return docs[0]
      })
      .then((res) => {
        if (!res) {
          return null
        }
        return this.service.stringifySyncableData(
          type,
          res.entity,
          res.checksum,
        )
      })
  }

  @Get('checksum')
  @HTTPDecorators.Bypass
  @CacheTTL(2)
  async getChecksum(@Query() query: SyncDataChecksumDto) {
    const { checksum, id, type } = query
    const dbChecksum = await this.service.getAndRefreshChecksum(type, id)

    if (dbChecksum === null) {
      return 'DELETED'
    }

    if (!checksum) {
      return dbChecksum
    }

    if (dbChecksum === checksum) {
      return 'OK'
    }

    return 'UPDATE'
  }
}
