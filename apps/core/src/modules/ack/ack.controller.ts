import {
  Body,
  HttpCode,
  Post,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Cookies } from '~/common/decorators/cookie.decorator'
import { BusinessEvents } from '~/constants/business-event.constant'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'
import type { CountModel } from '~/shared/model/count.model'
import type { FastifyReply } from 'fastify'
import { AckDto, AckEventType, AckReadPayloadSchema } from './ack.schema'

@ApiController('ack')
export class AckController {
  constructor(
    private readonly countingService: CountingService,

    private readonly webGateway: WebEventsGateway,
  ) {}

  @Post('/')
  @HttpCode(200)
  async ack(
    @Body() body: AckDto,
    @Cookies() cookies: Record<string, string>,
    @Res() res: FastifyReply,
  ) {
    const { type, payload } = body

    switch (type) {
      case AckEventType.READ: {
        const result = AckReadPayloadSchema.safeParse(payload)
        if (!result.success) {
          const errorMessages = result.error.issues.map((err) => {
            const path = err.path.join('.')
            return path ? `${path}: ${err.message}` : err.message
          })
          throw new UnprocessableEntityException(errorMessages.join('; '))
        }

        const { id, type } = result.data
        const doc = await this.countingService.updateReadCount(type, id)

        if ('count' in doc)
          this.webGateway.broadcast(BusinessEvents.ARTICLE_READ_COUNT_UPDATE, {
            count: -~(
              doc as {
                count: CountModel
              }
            ).count.read!,
            id,
            type,
          })

        return res.send()

        // disable ack read limit
        // const validPayload = plainToInstance(AckReadPayloadDto, payload)
        // const errors = validateSync(validPayload, this.validateOptions)
        // if (errors.length) {
        //   const error = this.validate.createExceptionFactory()(errors as any[])
        //   throw error
        // }
        // const { id, type } = validPayload

        // if (uuidReq) {
        //   const cacheKey = getRedisKey(RedisKeys.Read, `ack-${uuidReq}-${id}`)
        //   const cacheValue = await this.cacheService.get(cacheKey)
        //   if (cacheValue) {
        //     return res.send()
        //   }
        //   await this.cacheService.set(cacheKey, '1', 12 * 60 * 60 * 1000)
        //   // @ts-expect-error
        //   await this.countingService.updateReadCount(type, id)
        //   return res.send()
        // }

        // const cookieKey = `ack-read-${id}`
        // // @ts-expect-error
        // await this.countingService.updateReadCount(type, id)
        // if (cookies[cookieKey]) {
        //   return res.send()
        // }

        // res.cookie(cookieKey, '1', {
        //   maxAge:
        //     // 12 hour
        //     12 * 60 * 60 * 1000,
        // })
      }
    }
  }
}
