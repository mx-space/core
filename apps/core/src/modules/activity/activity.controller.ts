import { Body, Get, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { PagerDto } from '~/shared/dto/pager.dto'

import { ActivityService } from './activity.service'
import { LikeBodyDto } from './dtos/like.dto'

@ApiController('/activity')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Post('/like')
  async thumbsUpArticle(
    @Body() body: LikeBodyDto,
    @IpLocation() location: IpRecord,
  ) {
    const { ip } = location
    const { id, type } = body

    await this.service.likeAndEmit(type, id, ip)

    return
  }

  @Get('/likes')
  async getLikeActivities(@Query() pager: PagerDto) {
    const { page, size } = pager

    return this.service.getLikeActivities(page, size)
  }
}
