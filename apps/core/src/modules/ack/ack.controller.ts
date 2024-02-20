import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { FastifyReply, FastifyRequest } from 'fastify'

import { Body, HttpCode, Inject, Post, Req, Res } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Cookies } from '~/common/decorators/cookie.decorator'
import { ExtendedValidationPipe } from '~/common/pipes/validation.pipe'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { CacheService } from '~/processors/redis/cache.service'

import { AckDto, AckEventType, AckReadPayloadDto } from './ack.dto'

@ApiController('ack')
export class AckController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly countingService: CountingService,
    @Inject(VALIDATION_PIPE_INJECTION)
    private readonly validatePipe: ExtendedValidationPipe,
  ) {}

  @Post('/')
  @HttpCode(200)
  async ack(
    @Body() body: AckDto,
    @Cookies() cookies: Record<string, string>,
    @Res() res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    const { type, payload } = body

    const uuidReq = req.headers['x-session-uuid']
    switch (type) {
      case AckEventType.READ: {
        const validPayload = plainToInstance(AckReadPayloadDto, payload)
        const errors = validateSync(
          validPayload,
          ExtendedValidationPipe.options,
        )
        if (errors.length) {
          const error = this.validatePipe.createExceptionFactory()(
            errors as any[],
          )
          throw error
        }

        const { id, type } = validPayload
        await this.countingService.updateReadCount(type, id)

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
