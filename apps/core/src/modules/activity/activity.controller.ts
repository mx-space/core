import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { keyBy, pick } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BypassCaseTransform } from '~/common/decorators/bypass-case-transform.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import {
  isExplicitSuccessEnvelope,
  OK_DATA,
  withMeta,
} from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { CollectionRefTypes } from '~/constants/db.constant'
import {
  applyArticleTranslationInPlace,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { BasicPagerDto } from '~/shared/dto/pager.dto'
import { SampleResponse } from '~/shared/sample/sample-response.decorator'

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
import { ActivitySampleService } from './sample/activity-sample.service'

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
  getLikeActivities(@Query() pager: BasicPagerDto) {
    const { page, size } = pager
    return this.service.getLikeActivities(page, size)
  }

  @Get('/')
  @Auth()
  @SampleResponse(ActivitySampleService, 'list')
  activities(@Query() pager: ActivityQueryDto) {
    const { page, size, type } = pager

    switch (type) {
      case Activity.Like: {
        return this.service.getLikeActivities(page, size)
      }
      case Activity.ReadDuration: {
        return this.service.getReadDurationActivities(page, size)
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
  // `presence` is keyed by visitor identity and `readers` by reader id; the
  // snake_case pass would mangle mixed-case id keys and break client lookups.
  @BypassCaseTransform(['presence', 'readers'])
  async getPresence(@Query() query: GetPresenceQueryDto) {
    const roomPresence = await this.service.getRoomPresence(query.roomName)

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
  deletePresence(
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
  deleteAllPresence() {
    return this.service.deleteAll()
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

    if (!lang) return { ...roomInfo, objects }

    const allItems = Object.values(objects).flat() as Array<{
      id: string
      title: string
      createdAt: Date
      modifiedAt?: Date | null
    }>

    const { results, meta } =
      await this.translationService.collectArticleTranslations({
        articles: allItems.map((item) => ({
          id: String(item.id),
          title: item.title ?? '',
          text: '',
          createdAt: item.createdAt,
          modifiedAt: item.modifiedAt ?? null,
        })),
        targetLang: lang,
        fields: ['title'],
      })

    for (const type of Object.keys(objects)) {
      for (const item of objects[type] as Array<Record<string, any>>) {
        const r = results.get(String(item.id))
        if (r)
          applyArticleTranslationInPlace(item, r as any, { fields: ['title'] })
      }
    }

    if (meta.size === 0) return { ...roomInfo, objects }

    return withMeta(
      { ...roomInfo, objects },
      new MetaObjectBuilder().translation(meta).build(),
    )
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
  @SampleResponse(ActivitySampleService, 'topReadings')
  async getTopReadings(
    @Query() query: ActivityTopReadingsDto,
    @Lang() lang?: string,
  ) {
    const top = query.top ?? 5
    const days = query.days ?? 14
    const result = await this.service.getTopReadings(top, days)
    return this.translateReadingList(result, lang)
  }

  @Auth()
  @Get('/reading/rank')
  @SampleResponse(ActivitySampleService, 'readingRank')
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
    return this.translateReadingList(result, lang)
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

    const { results, meta } =
      await this.translationService.collectArticleTranslations({
        articles: data
          .filter((item) => item.ref)
          .map((item) => ({
            id: String(item.refId),
            title: (item.ref as any)?.title ?? '',
            text: '',
            createdAt: (item.ref as any)?.createdAt,
            modifiedAt: null as Date | null,
          })),
        targetLang: lang,
        fields: ['title'],
      })

    for (const item of data) {
      if (!item.ref) continue
      const r = results.get(String(item.refId))
      if (r)
        applyArticleTranslationInPlace(
          item.ref as Record<string, any>,
          r as any,
          {
            fields: ['title'],
          },
        )
    }

    if (meta.size === 0) return data

    return withMeta(data, new MetaObjectBuilder().translation(meta).build())
  }

  @Get('/recent')
  async getRecentActivities(@Lang() lang?: string) {
    const [like, comment, recentPublish] = await Promise.all([
      this.service.getLikeActivities(1, 5),
      this.service.getRecentComment(),
      this.service.getRecentPublish(),
    ])

    const transformedLike = like.data.map((item) => {
      const likeData = pick(item, 'createdAt', 'id') as any
      if (!item.ref) {
        likeData.title = 'Deleted content'
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

    const post = recentPublish.post as any[]
    const note = recentPublish.note as any[]

    if (!lang) {
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

    const likeSnapshots = transformedLike
      .filter((item) => item.articleId && item.title !== 'Deleted content')
      .map((item) => ({
        id: String(item.articleId),
        title: item.title ?? '',
        text: '',
        createdAt: item.createdAt,
        modifiedAt: null as Date | null,
      }))

    const postSnapshots = post.map((item) => ({
      id: String(item.id),
      title: item.title ?? '',
      text: '',
      createdAt: item.createdAt,
      modifiedAt: item.modifiedAt ?? null,
    }))

    const noteSnapshots = note.map((item) => ({
      id: String(item.id),
      title: item.title ?? '',
      text: '',
      createdAt: item.createdAt,
      modifiedAt: item.modifiedAt ?? null,
    }))

    const [likeCollect, postCollect, noteCollect] = await Promise.all([
      this.translationService.collectArticleTranslations({
        articles: likeSnapshots,
        targetLang: lang,
        fields: ['title'],
      }),
      this.translationService.collectArticleTranslations({
        articles: postSnapshots,
        targetLang: lang,
        fields: ['title'],
      }),
      this.translationService.collectArticleTranslations({
        articles: noteSnapshots,
        targetLang: lang,
        fields: ['title'],
      }),
    ])

    for (const item of transformedLike) {
      if (!item.articleId || item.title === 'Deleted content') continue
      const r = likeCollect.results.get(String(item.articleId))
      if (r)
        applyArticleTranslationInPlace(item, r as any, { fields: ['title'] })
    }

    for (const item of post) {
      const r = postCollect.results.get(String(item.id))
      if (r)
        applyArticleTranslationInPlace(item, r as any, { fields: ['title'] })
    }

    for (const item of note) {
      const r = noteCollect.results.get(String(item.id))
      if (r)
        applyArticleTranslationInPlace(item, r as any, { fields: ['title'] })
    }

    for (const item of transformedLike) {
      delete item.articleId
    }

    const combinedMeta = new Map([
      ...likeCollect.meta,
      ...postCollect.meta,
      ...noteCollect.meta,
    ])

    const data = {
      like: transformedLike,
      comment,
      recent: recentPublish.recent,
      post,
      note,
    }

    if (combinedMeta.size === 0) return data

    return withMeta(
      data,
      new MetaObjectBuilder().translation(combinedMeta).build(),
    )
  }

  @HTTPDecorators.SkipLogging
  @Get('/recent/notification')
  async getNotification(
    @Query() query: ActivityNotificationDto,
    @Lang() lang?: string,
  ) {
    const fromDate = new Date(query.from)
    if (fromDate > new Date()) return []

    const raw = await this.getRecentActivities(lang)
    const result = isExplicitSuccessEnvelope(raw) ? raw.data : raw
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

    const posts = result.posts as any[]
    const notes = result.notes as any[]

    const postSnapshots = posts.map((item: any) => ({
      id: String(item.id),
      title: item.title ?? '',
      text: '',
      createdAt: item.createdAt,
      modifiedAt: item.modifiedAt ?? null,
    }))

    const noteSnapshots = notes
      .filter((item: any) => item.title !== 'Private note')
      .map((item: any) => ({
        id: String(item.id),
        title: item.title ?? '',
        text: '',
        createdAt: item.createdAt,
        modifiedAt: item.modifiedAt ?? null,
      }))

    const [postCollect, noteCollect] = await Promise.all([
      this.translationService.collectArticleTranslations({
        articles: postSnapshots,
        targetLang: lang,
        fields: ['title'],
      }),
      this.translationService.collectArticleTranslations({
        articles: noteSnapshots,
        targetLang: lang,
        fields: ['title'],
      }),
    ])

    for (const item of posts) {
      const r = postCollect.results.get(String(item.id))
      if (r)
        applyArticleTranslationInPlace(item, r as any, { fields: ['title'] })
    }

    for (const item of notes) {
      if (item.title === 'Private note') continue
      const r = noteCollect.results.get(String(item.id))
      if (r)
        applyArticleTranslationInPlace(item, r as any, { fields: ['title'] })
    }

    const combinedMeta = new Map([...postCollect.meta, ...noteCollect.meta])

    if (combinedMeta.size === 0) return result

    return withMeta(
      result,
      new MetaObjectBuilder().translation(combinedMeta).build(),
    )
  }
}
