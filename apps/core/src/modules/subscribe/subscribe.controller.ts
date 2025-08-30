import { BadRequestException, Body, Get, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { PagerDto } from '~/shared/dto/pager.dto'
import { SubscribeTypeToBitMap } from './subscribe.constant'
import { CancelSubscribeDto, SubscribeDto } from './subscribe.dto'
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
      throw new BadRequestException('订阅功能未开启')
    }
    const { email, types } = body
    let bit = 0
    for (const type of types) {
      bit |= this.service.subscribeTypeToBit(type as any)
    }

    if (bit === 0) {
      throw new BadRequestException('订阅类型不为空')
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
