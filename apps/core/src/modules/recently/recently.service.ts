import { forwardRef, Inject, Injectable } from '@nestjs/common'

import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'

import { CommentService } from '../comment/comment.service'
import { EnrichmentService } from '../enrichment/enrichment.service'
import type { EnrichmentResult } from '../enrichment/enrichment.types'
import { UrlExtractorService } from '../enrichment/url-extractor.service'
import { RecentlyRepository } from './recently.repository'
import { RecentlyAttitudeEnum, RecentlyTypeEnum } from './recently.schema'
import { RecentlyModel, type RecentlyRow } from './recently.types'

type EnrichmentMap = Record<string, EnrichmentResult>

/**
 * Minimal hydrated reference returned alongside a recently row when its
 * `refType`/`refId` point at a post/note/page/recently. Mirrors the small
 * surface that admin and Yohaku consumers actually read from `item.ref`.
 */
export type RecentlyRefSummary = {
  id: string
  type: CollectionRefTypes
  title?: string
  slug?: string | null
  nid?: number
  url?: string
}

export type RecentlyWithRef = RecentlyRow & { ref?: RecentlyRefSummary | null }

@Injectable()
export class RecentlyService {
  constructor(
    private readonly recentlyRepository: RecentlyRepository,
    private readonly eventManager: EventManagerService,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    @Inject(forwardRef(() => EnrichmentService))
    private readonly enrichmentService: EnrichmentService,
    private readonly urlExtractor: UrlExtractorService,
  ) {}

  public get repository() {
    return this.recentlyRepository
  }

  async findById(id: string) {
    const row = await this.recentlyRepository.findById(id)
    if (!row) return row
    const withCount = await this.attachCommentCount([row])
    const [withRef] = await this.attachRef(withCount)
    const [withEnrichment] = await this.attachEnrichments([withRef])
    return withEnrichment
  }

  async findRecent(size: number) {
    const rows = await this.recentlyRepository.findRecent(size)
    const withRef = await this.attachRef(await this.attachCommentCount(rows))
    return this.attachEnrichments(withRef)
  }

  async count() {
    return this.recentlyRepository.count()
  }

  async getAll() {
    const result = await this.recentlyRepository.list(1, 50)
    const withRef = await this.attachRef(
      await this.attachCommentCount(result.data),
    )
    return this.attachEnrichments(withRef)
  }

  async getOne(id: string) {
    return this.findById(id)
  }

  /**
   * Resolve `refType`/`refId` on each row to a small joined `ref` summary.
   * Batched via `databaseService.findGlobalByIds` to avoid N+1.
   *
   * Rows whose `refId` is null get `ref: null`. Rows whose ref points at a
   * deleted entity also get `ref: null` (orphan refs must never crash the
   * response).
   */
  private async attachRef<T extends RecentlyRow>(
    rows: T[],
  ): Promise<Array<T & { ref?: RecentlyRefSummary | null }>> {
    if (rows.length === 0) return []
    const refIds = [
      ...new Set(
        rows
          .map((r) => r.refId)
          .filter((id): id is NonNullable<typeof id> => !!id)
          .map(String),
      ),
    ]
    if (refIds.length === 0) {
      return rows.map((row) => ({
        ...row,
        ref: row.refId ? null : undefined,
      }))
    }

    const collection = await this.databaseService.findGlobalByIds(refIds)
    const flat = this.databaseService.flatCollectionToMap(collection)
    const typeMap = new Map<string, CollectionRefTypes>()
    for (const item of collection.posts)
      typeMap.set(item.id, CollectionRefTypes.Post)
    for (const item of collection.notes)
      typeMap.set(item.id, CollectionRefTypes.Note)
    for (const item of collection.pages)
      typeMap.set(item.id, CollectionRefTypes.Page)
    for (const item of collection.recentlies)
      typeMap.set(item.id, CollectionRefTypes.Recently)

    return rows.map((row) => {
      if (!row.refId) return { ...row, ref: undefined }
      const refIdStr = String(row.refId)
      const doc = flat[refIdStr]
      const type = typeMap.get(refIdStr)
      if (!doc || !type) return { ...row, ref: null }
      return { ...row, ref: this.buildRefSummary(type, doc) }
    })
  }

  private buildRefSummary(
    type: CollectionRefTypes,
    doc: any,
  ): RecentlyRefSummary {
    const summary: RecentlyRefSummary = {
      id: doc.id,
      type,
      title: doc.title,
    }
    if (type === CollectionRefTypes.Note) {
      summary.nid = doc.nid
      summary.url = `/notes/${doc.nid}`
    } else if (type === CollectionRefTypes.Post) {
      summary.slug = doc.slug
      const categorySlug = doc.category?.slug
      if (categorySlug)
        summary.url = `/posts/${categorySlug}/${encodeURIComponent(doc.slug)}`
    } else if (type === CollectionRefTypes.Page) {
      summary.slug = doc.slug
      summary.url = `/${doc.slug}`
    } else if (type === CollectionRefTypes.Recently) {
      summary.url = `/thinking/${doc.id}`
    }
    return summary
  }

  async getOffset({
    before,
    size,
    after,
  }: {
    before?: string
    size?: number
    after?: string
  }) {
    const rows = await this.recentlyRepository.findOffset({
      before,
      after,
      size: size ?? 10,
    })
    const withRef = await this.attachRef(await this.attachCommentCount(rows))
    return this.attachEnrichments(withRef)
  }

  async getLatestOne() {
    const [latest] = await this.findRecent(1)
    return latest ?? null
  }

  /**
   * Stamp `commentsIndex` with the live comment count per row. The persistent
   * counter column drifts (it is not incremented on comment create), so all
   * read paths recompute it before returning. Mongo did this via a
   * `$lookup`-driven `$addFields: { comments: { $size: ... } }` pipeline; PG
   * does it as a single batched count grouped by `ref_id`.
   */
  private async attachCommentCount<T extends RecentlyRow>(
    rows: T[],
  ): Promise<T[]> {
    if (rows.length === 0) return rows
    const ids = rows.map((r) => String(r.id))
    const map = await this.commentService.countManyByRef(
      CollectionRefTypes.Recently,
      ids,
    )
    for (const row of rows) {
      row.commentsIndex = map.get(String(row.id)) ?? 0
    }
    return rows
  }

  async create(model: RecentlyModel) {
    let refType = model.refType
    const refId = model.refId ?? (model as any).ref
    if (refId) {
      const existModel = await this.databaseService.findGlobalById(refId)
      if (!existModel || !existModel.type) {
        throw new BizException(ErrorCodeEnum.RefModelNotFound)
      }
      refType = existModel.type
    }

    const content = model.content ?? ''
    const urls = this.urlExtractor.extractFromMarkdown(content)

    const withRef = await this.recentlyRepository.create({
      content,
      type: urls.length > 0 ? RecentlyTypeEnum.Link : RecentlyTypeEnum.Text,
      refId,
      refType: refType as any,
    })
    this.enrichmentService.schedulePrefetchUrls(urls)
    scheduleManager.schedule(async () => {
      await this.eventManager.emit(BusinessEvents.RECENTLY_CREATE, withRef, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
    })
    return withRef
  }

  async delete(id: string) {
    const deleted = await this.recentlyRepository.deleteById(id)
    await this.commentService.deleteForRef(CollectionRefTypes.Recently, id)
    const isDeleted = !!deleted
    scheduleManager.schedule(async () => {
      if (isDeleted) {
        await this.eventManager.emit(
          BusinessEvents.RECENTLY_DELETE,
          { id },
          { scope: EventScope.TO_SYSTEM_VISITOR },
        )
      }
    })
    return isDeleted
  }

  async update(id: string, model: Partial<RecentlyModel>) {
    const contentChanged = model.content !== undefined
    const urls = contentChanged
      ? this.urlExtractor.extractFromMarkdown(model.content ?? '')
      : []

    const withRef = await this.recentlyRepository.update(id, {
      content: model.content,
      type: contentChanged
        ? urls.length > 0
          ? RecentlyTypeEnum.Link
          : RecentlyTypeEnum.Text
        : undefined,
      modifiedAt: new Date(),
    })
    if (!withRef) return null
    if (contentChanged) {
      this.enrichmentService.schedulePrefetchUrls(urls)
    }
    scheduleManager.schedule(async () => {
      await this.eventManager.emit(BusinessEvents.RECENTLY_UPDATE, withRef, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
    })
    return withRef
  }

  async updateAttitude({
    id,
    attitude,
    ip,
  }: {
    id: string
    attitude: RecentlyAttitudeEnum
    ip: string
  }) {
    if (!ip) throw new BizException(ErrorCodeEnum.CannotGetIp)
    const model = await this.recentlyRepository.findById(id)
    if (!model) throw new CannotFindException()

    const redis = this.redisService.getClient()
    const redisKey = getRedisKey(RedisKeys.RecentlyAttitude)
    const key = `${id}:${ip}`
    const currentAttitude = await redis.hget(redisKey, key)
    const persist = () =>
      redis.hset(
        redisKey,
        key,
        JSON.stringify({ attitude, date: new Date().toISOString() }),
      )

    if (!currentAttitude) {
      await this.adjustScore(id, attitude, 1)
      await persist()
      return 1
    }

    const { attitude: prevAttitude } = JSON.parse(currentAttitude)
    if (prevAttitude === attitude) {
      await this.adjustScore(id, prevAttitude, -1)
      await redis.hdel(redisKey, key)
      return -1
    }
    await this.switchScore(id, prevAttitude)
    await persist()
    return 1
  }

  private async adjustScore(
    id: string,
    attitude: RecentlyAttitudeEnum,
    delta: number,
  ) {
    if (attitude === RecentlyAttitudeEnum.Up) {
      await this.recentlyRepository.incrementUp(id, delta)
    } else {
      await this.recentlyRepository.incrementDown(id, delta)
    }
  }

  private async switchScore(id: string, prevAttitude: RecentlyAttitudeEnum) {
    if (prevAttitude === RecentlyAttitudeEnum.Up) {
      await this.recentlyRepository.incrementUp(id, -1)
      await this.recentlyRepository.incrementDown(id, 1)
    } else {
      await this.recentlyRepository.incrementDown(id, -1)
      await this.recentlyRepository.incrementUp(id, 1)
    }
  }

  /**
   * Attach an `enrichments` map keyed by URL to each row. Scans every row's
   * markdown `content` for single-link-paragraph URLs, hydrates the deduped
   * union in one batch via {@link EnrichmentService.hydrateUrls}, then maps
   * each row's own URLs back. Same contract as post/note/page link cards.
   */
  private async attachEnrichments<T extends RecentlyRow>(
    rows: T[],
  ): Promise<Array<T & { enrichments: EnrichmentMap }>> {
    if (rows.length === 0) return []

    const urlsByRow = rows.map((row) =>
      this.urlExtractor.extractFromMarkdown(row.content),
    )
    const allUrls = [...new Set(urlsByRow.flat())]
    if (allUrls.length === 0) {
      return rows.map((row) => ({ ...row, enrichments: {} }))
    }

    const lang = RequestContext.currentLang()
    let map: EnrichmentMap = {}
    try {
      map = await this.enrichmentService.hydrateUrls(allUrls, lang)
    } catch {
      // hydration failure must never crash the list response
    }

    return rows.map((row, i) => {
      const enrichments: EnrichmentMap = {}
      for (const url of urlsByRow[i]) {
        const result = map[url]
        if (result) enrichments[url] = result
      }
      return { ...row, enrichments }
    })
  }
}
