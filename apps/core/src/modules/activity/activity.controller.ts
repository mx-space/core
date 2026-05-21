import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { keyBy, pick } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { OK_DATA } from '~/common/response/envelope.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

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
  'createdAt',
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
    private readonly translationService: TranslationService,
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
    return OK_DATA
  }

  @Get('/likes')
  @Auth()
  async getLikeActivities(@Query() pager: BasicPagerDto) {
    const { page, size } = pager

    const result = await this.service.getLikeActivities(page, size)
    return result
  }

  @Get('/')
  @Auth()
  async activities(@Query() pager: ActivityQueryDto) {
    const { page, size, type } = pager

    switch (type) {
      case Activity.Like: {
        const result = await this.service.getLikeActivities(page, size)
        return result
      }

      case Activity.ReadDuration: {
        const result = await this.service.getReadDurationActivities(page, size)
        return result
      }
    }
    return null
  }

  @Post('/presence/update')
  async updatePresence(
    @Body() body: UpdatePresenceDto,
    @IpLocation() location: IpRecord,
  ) {
    await this.service.updatePresence(body, location.ip)
    return OK_DATA
  }

  @Get('/presence')
  @HTTPDecorators.SkipLogging
  async getPresence(@Query() query: GetPresenceQueryDto) {
    const roomPresence = await this.service.getRoomPresence(query.room_name)

    const readerIds = roomPresence
      .map((item) => item.readerId)
      .filter(Boolean) as string[]
    const readerRows = await this.readerService.findReaderInIds(readerIds)
    const readers = readerRows.map((item) => ({ ...item, id: item.id }))

    return {
      presence: keyBy(
        roomPresence.map(({ ip, ...item }) => item),
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
    const result = await this.service.deleteActivityByType(
      params.type,
      body.before ? new Date(body.before) : new Date(),
    )
    return result
  }

  @Auth()
  @Delete('/all')
  async deleteAllPresence() {
    const result = await this.service.deleteAll()
    return result
  }

  @Get('/rooms')
  async getRoomsInfo(@Lang() lang?: string) {
    const roomInfo = await this.service.getAllRoomNames()
    const { objects } = await this.service.getRefsFromRoomNames(roomInfo.rooms)

    for (const type of Object.keys(objects)) {
      objects[type] = objects[type].map((item) =>
        pick(item, ARTICLE_REF_FIELDS),
      )
    }

    if (lang) {
      for (const type of Object.keys(objects)) {
        if (!objects[type].length) continue
        objects[type] = await this.translationService.translateList({
          items: objects[type],
          targetLang: lang,
          translationFields: ['title', 'translationMeta'] as const,
          getInput: (item: any) => ({
            id: item.id ?? '',
            title: item.title ?? '',
            createdAt: item.createdAt,
          }),
          applyResult: (item: any, translation) => {
            if (!translation?.isTranslated) return item
            return {
              ...item,
              title: translation.title,
              isTranslated: true,
              translationMeta: translation.translationMeta,
            }
          },
        })
      }
    }

    return { ...roomInfo, objects }
  }

  @Get('/online-count')
  async getOnlineCount() {
    const roomInfo = await this.service.getAllRoomNames()
    const total = Object.values(roomInfo.roomCount).reduce(
      (acc, count) => acc + count,
      0,
    )
    return { total, rooms: roomInfo.roomCount }
  }

  @Auth()
  @Get('/reading/top')
  @HttpCache({ ttl: 300, force: true, withQuery: true })
  async getTopReadings(
    @Query() query: ActivityTopReadingsDto,
    @Lang() lang?: string,
  ) {
    const top = query.top ?? 5
    const days = query.days ?? 14
    const result = await this.service.getTopReadings(top, days)
    const data = await this.translateReadingList(result, lang)
    return data
  }

  @Auth()
  @Get('/reading/rank')
  async getReadingRangeRank(
    @Query() query: ActivityRangeDto,
    @Lang() lang?: string,
  ) {
    const startAt = query.start ? new Date(query.start) : undefined
    const endAt = query.end ? new Date(query.end) : undefined
    const limit = query.limit ?? 50

    const result = await this.service.getDateRangeOfReadings(
      startAt,
      endAt,
      limit,
    )
    const data = await this.translateReadingList(result, lang)
    return data
  }

  private async translateReadingList(
    result: Array<{ refId: string; ref?: any; count: number }>,
    lang?: string,
  ) {
    const data = result.map((item) => ({
      ...item,
      ref: pick(item.ref, ARTICLE_REF_FIELDS),
    }))
    if (!lang) return data
    return this.translationService.translateList({
      items: data,
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => {
        const ref = item.ref as Record<string, any> | undefined
        return {
          id: item.refId,
          title: ref?.title ?? '',
          created: ref?.createdAt,
        }
      },
      applyResult: (item, translation) => {
        if (!translation?.isTranslated || !item.ref) return item
        return {
          ...item,
          ref: { ...item.ref, title: translation.title },
          isTranslated: true,
          translationMeta: translation.translationMeta,
        }
      },
    })
  }

  @Get('/recent')
  async getRecentActivities(@Lang() lang?: string) {
    const [like, comment, recentPublish] = await Promise.all([
      this.service.getLikeActivities(1, 5),
      this.service.getRecentComment(),
      this.service.getRecentPublish(),
    ])

    let transformedLike = like.data.map((item) => {
      const likeData = pick(item, 'createdAt', 'id') as any
      if (!item.ref) {
        likeData.title = '已删除的内容'
        return likeData
      }
      if ('nid' in item.ref) {
        likeData.type = CollectionRefTypes.Note
        likeData.nid = item.ref.nid
      } else {
        likeData.type = CollectionRefTypes.Post
        likeData.slug = item.ref.slug
      }
      likeData.title = item.ref.title
      likeData.articleId = (item.payload as { id?: string } | null)?.id
      return likeData
    })

    let post = recentPublish.post as any[]
    let note = recentPublish.note as any[]

    if (lang) {
      const translateTitleOnly = <T extends Record<string, any>>(
        items: T[],
        getId: (item: T) => string,
      ) =>
        this.translationService.translateList({
          items,
          targetLang: lang,
          translationFields: ['title'] as const,
          getInput: (item) => ({
            id: getId(item),
            title: item.title ?? '',
            createdAt: item.createdAt,
            modifiedAt: item.modifiedAt,
          }),
          applyResult: (item, translation) =>
            translation?.isTranslated
              ? { ...item, title: translation.title }
              : item,
        })

      transformedLike = await translateTitleOnly(
        transformedLike,
        (item) => item.articleId ?? '',
      )
      post = await translateTitleOnly(post, (item) => item.id)
      note = await translateTitleOnly(note, (item) => item.id)
    }

    for (const item of transformedLike) {
      delete item.articleId
    }

    return {
      like: transformedLike,
      comment,
      recent: recentPublish.recent,
      post,
      note,
    }
  }

  @HTTPDecorators.SkipLogging
  @Get('/recent/notification')
  async getNotification(
    @Query() query: ActivityNotificationDto,
    @Lang() lang?: string,
  ) {
    const fromDate = new Date(query.from)
    if (fromDate > new Date()) return []

    const result = await this.getRecentActivities(lang)
    const { post, note } = result
    const isAfter = (item: any) => new Date(item.createdAt) > fromDate

    const postList = post.filter(isAfter).map((item) => ({
      title: item.title,
      type: CollectionRefTypes.Post,
      id: item.id,
      slug: item.slug,
    }))
    const noteList = note.filter(isAfter).map((item) => ({
      title: item.title,
      type: CollectionRefTypes.Note,
      id: item.nid,
    }))

    return [...postList, ...noteList]
  }

  @Get('/last-year/publication')
  async getLastYearPublication(@Lang() lang?: string) {
    const result = await this.service.getLastYearPublication()
    if (!lang) return result

    if (result.posts.length) {
      result.posts = await this.translationService.translateList({
        items: result.posts as any[],
        targetLang: lang,
        translationFields: ['title', 'translationMeta'] as const,
        getInput: (item: any) => ({
          id: item.id,
          title: item.title ?? '',
          createdAt: item.createdAt,
        }),
        applyResult: (item: any, translation) => {
          if (!translation?.isTranslated) return item
          return {
            ...item,
            title: translation.title,
            isTranslated: true,
            translationMeta: translation.translationMeta,
          }
        },
      })
    }

    if (result.notes.length) {
      result.notes = await this.translationService.translateList({
        items: result.notes as any[],
        targetLang: lang,
        translationFields: ['title', 'translationMeta'] as const,
        getInput: (item: any) => ({
          id: item.title === '未公开的日记' ? '' : item.id,
          title: item.title ?? '',
          createdAt: item.createdAt,
        }),
        applyResult: (item: any, translation) => {
          if (!translation?.isTranslated) return item
          return {
            ...item,
            title: translation.title,
            isTranslated: true,
            translationMeta: translation.translationMeta,
          }
        },
      })
    }

    return result
  }
}
