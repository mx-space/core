import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { CollectionRefTypes } from '~/constants/db.constant'
import { PagerDto } from '~/shared/dto/pager.dto'
import { keyBy, pick } from 'lodash'
import snakecaseKeys from 'snakecase-keys'
import { ReaderService } from '../reader/reader.service'
import { Activity } from './activity.constant'
import { ActivityService } from './activity.service'
import {
  ActivityDeleteDto,
  ActivityNotificationDto,
  ActivityQueryDto,
  ActivityRangeDto,
  ActivityTypeParamsDto,
} from './dtos/activity.dto'
import { LikeBodyDto } from './dtos/like.dto'
import { GetPresenceQueryDto, UpdatePresenceDto } from './dtos/presence.dto'

@ApiController('/activity')
export class ActivityController {
  constructor(
    private readonly service: ActivityService,
    private readonly readerService: ReaderService,
  ) {}

  @Post('/like')
  async thumbsUpArticle(
    @Body() body: LikeBodyDto,
    @IpLocation() location: IpRecord,
  ) {
    const { ip } = location
    const { id, type } = body

    await this.service.likeAndEmit(type.toLowerCase() as any, id, ip)

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
  async activities(@Query() pager: ActivityQueryDto) {
    const { page, size, type } = pager

    switch (type) {
      case Activity.Like:
        return this.service.getLikeActivities(page, size)

      case Activity.ReadDuration:
        return this.service.getReadDurationActivities(page, size)
    }
  }

  @Post('/presence/update')
  async updatePresence(
    @Body() body: UpdatePresenceDto,
    @IpLocation() location: IpRecord,
  ) {
    await this.service.updatePresence(body, location.ip)
  }

  @Get('/presence')
  @HTTPDecorators.SkipLogging
  @HTTPDecorators.Bypass
  async getPresence(@Query() query: GetPresenceQueryDto) {
    const roomPresence = await this.service.getRoomPresence(query.room_name)

    const readerIds = [] as string[]
    for (const item of roomPresence) {
      if (item.readerId) {
        readerIds.push(item.readerId)
      }
    }
    const readers = await this.readerService
      .findReaderInIds(readerIds)
      .then((arr) => {
        return arr.map((item) => {
          return snakecaseKeys({
            ...item,
            id: item._id.toHexString(),
          })
        })
      })

    return {
      data: keyBy(
        roomPresence.map(({ ip, ...item }) => {
          return snakecaseKeys(item)
        }),
        'identity',
      ),

      readers: keyBy(readers, 'id'),
    }
  }

  @Delete('/:type')
  @Auth()
  async deletePresence(
    @Param() params: ActivityTypeParamsDto,
    @Body() Body: ActivityDeleteDto,
  ) {
    return this.service.deleteActivityByType(
      params.type,
      Body.before ? new Date(Body.before) : new Date(),
    )
  }

  @Auth()
  @Delete('/all')
  async deleteAllPresence() {
    return this.service.deleteAll()
  }

  @Get('/rooms')
  async getRoomsInfo() {
    const roomInfo = await this.service.getAllRoomNames()
    const { objects } = await this.service.getRefsFromRoomNames(roomInfo.rooms)

    for (const type in objects) {
      objects[type] = objects[type].map((item) => {
        return pick(item, [
          'title',
          'slug',
          'cover',
          'created',
          'category',
          'categoryId',
          'id',
          'nid',
        ])
      })
    }

    return {
      ...roomInfo,
      objects,
    }
  }

  @Auth()
  @Get('/reading/rank')
  async getReadingRangeRank(@Query() query: ActivityRangeDto) {
    const startAt = query.start ? new Date(query.start) : undefined
    const endAt = query.end ? new Date(query.end) : undefined

    return this.service
      .getDateRangeOfReadings(startAt, endAt)
      .then((arr) => {
        return arr.sort((a, b) => {
          return b.count - a.count
        })
      })
      .then((arr) => {
        // omit ref fields

        return arr.map((item) => {
          return {
            ...item,
            ref: pick(item.ref, [
              'title',
              'slug',
              'cover',
              'created',
              'category',
              'categoryId',
              'id',
              'nid',
            ]),
          }
        })
      })
  }

  @Get('/recent')
  async getRecentActivities() {
    const [like, comment, recent] = await Promise.all([
      this.service.getLikeActivities(1, 5),
      this.service.getRecentComment(),
      this.service.getRecentPublish(),
    ])

    const transformedLike = [] as any[]

    for (const item of like.data) {
      const likeData = pick(item, 'created', 'id') as any

      if (!item.ref) {
        likeData.title = '已删除的内容'
      } else {
        if ('nid' in item.ref) {
          likeData.type = CollectionRefTypes.Note
          likeData.nid = item.ref.nid
        } else {
          likeData.type = CollectionRefTypes.Post
          likeData.slug = item.ref.slug
        }
        likeData.title = item.ref.title
      }

      transformedLike.push(likeData)
    }

    return {
      like: transformedLike,
      comment,
      ...recent,
    }
  }

  @HTTPDecorators.SkipLogging
  @Get('/recent/notification')
  async getNotification(@Query() query: ActivityNotificationDto) {
    const activity = await this.getRecentActivities()

    const { from } = query

    const fromDate = new Date(from)
    const now = new Date()

    if (fromDate > now) {
      return []
    }

    const { post, note } = activity

    const postList = post
      .filter((item) => {
        return new Date(item.created) > fromDate
      })
      .map((item) => {
        return {
          title: item.title,
          type: CollectionRefTypes.Post,
          id: item.id,
          slug: item.slug,
        }
      })
    const noteList = note
      .filter((item) => {
        return new Date(item.created) > fromDate
      })
      .map((item) => {
        return {
          title: item.title,
          type: CollectionRefTypes.Note,
          id: item.nid,
        }
      })

    return [...postList, ...noteList]
  }

  @Get('/last-year/publication')
  getLastYearPublication() {
    return this.service.getLastYearPublication()
  }
}
