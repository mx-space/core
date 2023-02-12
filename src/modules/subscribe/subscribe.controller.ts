import { Body, Get, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { PagerDto } from '~/shared/dto/pager.dto'

import { CancelSubscribeDto, SubscribeDto } from './subscribe.dto'
import { SubscribeService } from './subscribe.service'

@ApiController('subscribe')
export class SubscribeController {
  constructor(private readonly service: SubscribeService) {}

  @Get('/')
  @HTTPDecorators.Paginator
  @Auth()
  async list(@Query() query: PagerDto) {
    const { page, size } = query
    return this.service.model.paginate(
      {},
      {
        page,
        limit: size,
      },
    )
  }

  @Post('/')
  async subscribe(@Body() body: SubscribeDto) {
    const { email, types } = body
    let bit = 0
    for (const type of types) {
      bit |= this.service.subscribeTypeToBit(type as any)
    }
    await this.service.subscribe(email, bit)
  }

  @Get('/unsubscribe')
  @HTTPDecorators.Bypass
  async unsubscribe(@Query() query: CancelSubscribeDto) {
    const { email, cancelToken } = query

    const result = await this.service.unsubscribe(email, cancelToken)
    if (result) {
      return '已取消订阅'
    }
    return '出现错误'
  }
}
