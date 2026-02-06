import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { CollectionRefTypes } from '~/constants/db.constant'
import { PagerDto } from '~/shared/dto/pager.dto'
import { snakecaseKeysWithCompat } from '~/utils/case.util'
import { keyBy, pick } from 'es-toolkit/compat'
import { ReaderService } from '../reader/reader.service'
import { Activity } from './activity.constant'
import {
  ActivityDeleteDto,
  ActivityNotificationDto,
  ActivityQueryDto,
  ActivityRangeDto,
  ActivityTopReadingsDto,
  ActivityTypeParamsDto,
  GetPresenceQueryDto,
  LikeBodyDto,
  UpdatePresenceDto,
} from './activity.schema'
import { ActivityService } from './activity.service'

const ARTICLE_REF_FIELDS = [
  'title',
  'slug',
  'cover',
  'created',
  'category',
  'categoryId',
  'id',
  'nid',
] as const

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

    await this.service.likeAndEmit(
      type.toLowerCase() as 'post' | 'note',
      id,
      ip,
    )
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

    const readerIds = roomPresence
      .map((item) => item.readerId)
      .filter(Boolean) as string[]
    const readers = await this.readerService
      .findReaderInIds(readerIds)
      .then((arr) => {
        return arr.map((item) => {
          return snakecaseKeysWithCompat({
            ...item,
            id: item._id.toHexString(),
          })
        })
      })

    return {
      data: keyBy(
        roomPresence.map(({ ip, ...item }) => {
          return snakecaseKeysWithCompat(item)
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
    @Body() body: ActivityDeleteDto,
  ) {
    return this.service.deleteActivityByType(
      params.type,
      body.before ? new Date(body.before) : new Date(),
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
        return pick(item, ARTICLE_REF_FIELDS)
      })
    }

    return {
      ...roomInfo,
      objects,
    }
  }

  @Get('/online-count')
  async getOnlineCount() {
    const roomInfo = await this.service.getAllRoomNames()
    const total = Object.values(roomInfo.roomCount).reduce(
      (acc, count) => acc + count,
      0,
    )
    return {
      total,
      rooms: roomInfo.roomCount,
    }
  }

  @Auth()
  @Get('/reading/top')
  @HttpCache({ ttl: 300, force: true, withQuery: true })
  async getTopReadings(@Query() query: ActivityTopReadingsDto) {
    const top = query.top ?? 5
    const days = query.days ?? 14
    const result = await this.service.getTopReadings(top, days)
    return result.map((item) => ({
      ...item,
      ref: pick(item.ref, ARTICLE_REF_FIELDS),
    }))
  }

  @Auth()
  @Get('/reading/rank')
  async getReadingRangeRank(@Query() query: ActivityRangeDto) {
    const startAt = query.start ? new Date(query.start) : undefined
    const endAt = query.end ? new Date(query.end) : undefined
    const limit = query.limit ?? 50

    const result = await this.service.getDateRangeOfReadings(
      startAt,
      endAt,
      limit,
    )
    return result.map((item) => ({
      ...item,
      ref: pick(item.ref, ARTICLE_REF_FIELDS),
    }))
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
