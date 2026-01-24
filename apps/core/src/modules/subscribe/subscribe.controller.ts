import { Body, Delete, Get, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
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
  // 检查特征是否开启
  @HTTPDecorators.Bypass
  async checkStatus() {
    const allow_types = ['note_c', 'post_c']
    return {
      enable: await this.service.checkEnable(),
      bit_map: SubscribeTypeToBitMap,
      // TODO move to service
      allow_bits: allow_types.map((t) => SubscribeTypeToBitMap[t]),
      allow_types,
    }
  }

  @Get('/')
  @HTTPDecorators.Paginator
  @Auth()
  async list(@Query() query: PagerDto) {
    const { page, size, sortBy, sortOrder } = query
    return this.service.model.paginate(
      {},
      {
        page,
        limit: size,
        sort: sortBy
          ? {
              [sortBy]: sortOrder,
            }
          : undefined,
      },
    )
  }

  @Post('/')
  async subscribe(@Body() body: SubscribeDto) {
    if (!(await this.service.checkEnable())) {
      throw new BizException(ErrorCodeEnum.SubscribeNotEnabled)
    }
    const { email, types } = body
    let bit = 0
    for (const type of types) {
      bit |= this.service.subscribeTypeToBit(type as any)
    }

    if (bit === 0) {
      throw new BizException(ErrorCodeEnum.SubscribeTypeEmpty)
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

  @Delete('/unsubscribe/batch')
  @Auth()
  async unsubscribeBatch(@Body() body: BatchUnsubscribeDto) {
    const { emails, all } = body
    const deletedCount = await this.service.unsubscribeBatch(emails, all)
    return { deletedCount }
  }
}
