import { Body, Delete, Get, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { PagerDto } from '~/shared/dto/pager.dto'

import { SubscribeTypeToBitMap } from './subscribe.constant'
import {
  BatchUnsubscribeDto,
  CancelSubscribeDto,
  SubscribeDto,
} from './subscribe.schema'
import { SubscribeService } from './subscribe.service'

@ApiController('subscribe')
export class SubscribeController {
  constructor(private readonly service: SubscribeService) {}

  @Get('/status')
  async checkStatus() {
    const allow_types = ['note_c', 'post_c']
    const enable = await this.service.checkEnable()
    return {
      enable,
      bit_map: SubscribeTypeToBitMap,
      allow_bits: allow_types.map((t) => SubscribeTypeToBitMap[t]),
      allow_types,
    }
  }

  @Get('/')
  @Auth()
  async list(@Query() query: PagerDto) {
    const { page = 1, size = 10 } = query
    const result = await this.service.list(page, size)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Post('/')
  async subscribe(@Body() body: SubscribeDto) {
    if (!(await this.service.checkEnable())) {
      throw createAppException(AppErrorCode.SUBSCRIBE_NOT_ENABLED)
    }
    const { email, types } = body
    let bit = 0
    for (const type of types) {
      bit |= this.service.subscribeTypeToBit(type as any)
    }

    if (bit === 0) {
      throw createAppException(AppErrorCode.SUBSCRIBE_TYPE_EMPTY)
    }
    await this.service.subscribe(email, bit)
  }

  @Get('/unsubscribe')
  @RawResponse
  async unsubscribe(@Query() query: CancelSubscribeDto) {
    const { email, cancelToken } = query

    const result = await this.service.unsubscribe(email, cancelToken)
    if (result) {
      return '已取消订阅'
    }
    return '出现错误'
  }

  @Delete('/unsubscribe/batch')
  @Auth()
  async unsubscribeBatch(@Body() body: BatchUnsubscribeDto) {
    const { emails, all } = body
    const deletedCount = await this.service.unsubscribeBatch(emails, all)
    return { deletedCount }
  }
}
