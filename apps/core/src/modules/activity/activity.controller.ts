import { keyBy } from 'lodash'

import { Body, Get, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { PagerDto } from '~/shared/dto/pager.dto'

import { ActivityService } from './activity.service'
import { LikeBodyDto } from './dtos/like.dto'
import { GetPresenceQueryDto, UpdatePresenceDto } from './dtos/presence.dto'

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
  @Auth()
  async getLikeActivities(@Query() pager: PagerDto) {
    const { page, size } = pager

    return this.service.getLikeActivities(page, size)
  }

  @Get('/')
  @Auth()
  async activities(@Query() pager: PagerDto) {
    const { page, size } = pager

    // TODO currently only support like activities, so hard code here
    return this.service.getLikeActivities(page, size)
  }

  @Post('/presence/update')
  async updatePresence(@Body() body: UpdatePresenceDto) {
    return this.service.updatePresence(body)
  }

  @Get('/presence')
  async getPresence(@Query() query: GetPresenceQueryDto) {
    return this.service.getRoomPresence(query.room_name).then((list) => {
      return keyBy(list, 'identity')
    })
  }
}
