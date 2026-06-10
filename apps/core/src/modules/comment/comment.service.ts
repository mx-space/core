import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { RequestContext } from '~/common/contexts/request.context'
import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getAvatar } from '~/utils/tool.util'

import { FileReferenceService } from '../file/file-reference.service'
import { FileDeletionReason } from '../file/file-reference.types'
import { OwnerService } from '../owner/owner.service'
import { ReaderService } from '../reader/reader.service'
import { ReaderModel } from '../reader/reader.types'
import { CommentState } from './comment.enum'
import { CommentRepository } from './comment.repository'
import type {
  AuthorActivity,
  AuthorActivityFilter,
  AuthorThreatLevel,
  CommentFindFilter,
  CommentModel,
  CommentRefType,
  CommentRow,
  CommentTab,
  CommentTabCounts,
  CommentTabCountsFilter,
} from './comment.types'
import { CommentCountryService } from './comment-country.service'

/**
 * Minimal hydrated reference attached to a comment when its `refType`/`refId`
 * resolve to a post/note/page/recently. Mirrors the surface that admin
 * `comment-detail.tsx` reads (`ref.title`, `ref.slug`, `ref.nid`,
 * `ref.category.slug`).
 */
export type CommentRefSummary = {
  id: string
  type: CollectionRefTypes
  title?: string
  slug?: string | null
  nid?: number
  category?: { name: string; slug: string } | null
}

export type CommentSourceCandidateSummary = CommentRefSummary & {
  commentCount: number
  latestCommentAt: Date
}

/**
 * Slim parent-comment preview attached to replies. Only the surface that the
 * admin `comment-detail.tsx` renders (`@author`, body text, deletion state).
 * Intentionally omits `ip`/`agent`/`mail`/etc. so the `/comments/:id` public
 * detail endpoint does not leak parent commenter PII.
 */
export type CommentParentPreview = {
  id: string
  author: string | null
  text: string
  isDeleted: boolean
}

const COMMENT_REPLY_THRESHOLD = 20
const COMMENT_REPLY_EDGE_SIZE = 3
const COMMENT_THREAD_BATCH_SIZE = 10
const COMMENT_DELETED_PLACEHOLDER = 'This comment has been deleted'

const TAB_COUNTS_KEY_PREFIX = 'comment:tab-counts:'
const TAB_COUNTS_TTL_SECONDS = 30
const AUTHOR_ACTIVITY_KEY_PREFIX = 'comment:author-activity:'
const AUTHOR_ACTIVITY_TTL_SECONDS = 300

const DEFAULT_STATE_TO_TAB: Record<number, CommentTab> = {
  0: 'unread',
  1: 'read',
  2: 'junk',
}

@Injectable()
export class CommentService {
  private readonly logger: Logger = new Logger(CommentService.name)
  private deprecatedStateWarned = false

  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly databaseService: DatabaseService,
    private readonly ownerService: OwnerService,
    private readonly eventManager: EventManagerService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
    @Inject(forwardRef(() => FileReferenceService))
    private readonly fileReferenceService: FileReferenceService,
    private readonly commentCountryService: CommentCountryService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Pull `cf-ipcountry` off the current request (set by the Cloudflare edge)
   * so it can be passed to the geoip lookup as a free hint. Returns null when
   * the request is not bound (background work) or the header is absent.
   */
  private currentCfIpCountryHint(): string | null {
    const request = RequestContext.currentRequest()
    if (!request) return null
    const headers = request.headers ?? {}
    const raw =
      headers['cf-ipcountry'] ??
      (headers as Record<string, unknown>)['CF-IPCountry']
    return typeof raw === 'string' ? raw : null
  }

  /**
   * Cascade-clean uploaded files when batch-updating comment state.
   * Moving comments to Junk (state=2) triggers hard deletion of the
   * associated reader-uploaded files (per configuration).
   */
  async cascadeFilesForCommentsIfSpam(commentIds: string[], state: number) {
    if (state !== CommentState.Junk) return
    for (const id of commentIds) {
      try {
        await this.fileReferenceService.hardDeleteFilesForComment(
          id,
          FileDeletionReason.CommentSpam,
        )
      } catch (err) {
        this.logger.warn(
          `cascadeFilesForCommentsIfSpam(${id}) failed: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
  }

  public get repository() {
    return this.commentRepository
  }

  private async assignReaderToComment(): Promise<
    (ReaderModel & { id: string }) | null
  > {
    const readerId = RequestContext.currentReaderId()
    if (!readerId) return null
    const readers = await this.readerService.findReaderInIds([readerId])
    const reader = readers[0] ?? null
    return reader ? { ...reader, id: readerId } : null
  }

  private stripReaderIdentitySnapshot(doc: Partial<CommentModel>) {
    delete doc.author
    delete doc.mail
    delete doc.avatar
    delete doc.url
  }

  private assignAuthProviderToComment(doc: Partial<CommentModel>) {
    const authProvider = RequestContext.currentAuthProvider()
    if (authProvider) doc.authProvider = authProvider
  }

  async findById(id: string) {
    return this.commentRepository.findById(id)
  }

  async findByIdWithRelations(id: string) {
    const comment = await this.commentRepository.findByIdWithRelations(id)
    if (!comment) return comment
    const [withRef] = await this.attachRef([comment])
    const parentRow = withRef.parent ?? null
    let parent: CommentParentPreview | null = null
    if (parentRow) {
      await this.fillAndReplaceAvatarUrl([parentRow as CommentModel])
      parent = this.toParentPreview(parentRow)
    }
    return { ...withRef, parent }
  }

  /**
   * Resolve the polymorphic `(refType, refId)` on each comment to a small
   * joined `ref` summary. Batched via `databaseService.findGlobalByIds`.
   *
   * Orphan refs (target deleted) become `ref: null` so consumers may render a
   * degraded label instead of crashing on `comment.ref.title`.
   */
  async attachRef<
    T extends Pick<CommentRow, 'refId' | 'refType'> & { id: any },
  >(rows: T[]): Promise<Array<T & { ref?: CommentRefSummary | null }>> {
    if (rows.length === 0) return []
    const refIds = [
      ...new Set(rows.map((r) => r.refId).filter((id): id is any => !!id)),
    ].map(String)
    if (refIds.length === 0) {
      return rows.map((row) => ({ ...row, ref: null }))
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
      if (!row.refId) return { ...row, ref: null }
      const refIdStr = String(row.refId)
      const doc = flat[refIdStr]
      const type = typeMap.get(refIdStr)
      if (!doc || !type) return { ...row, ref: null }
      return { ...row, ref: this.buildCommentRefSummary(type, doc) }
    })
  }

  /**
   * Resolve the `parentCommentId` on each row to a slim `parent` preview.
   * Batched via `findManyByIds`; reader/owner identity is resolved on the
   * parent rows so `parent.author` reflects the same name the dashboard would
   * render for the parent itself.
   */
  async attachParentPreview<T extends Pick<CommentRow, 'parentCommentId'>>(
    rows: T[],
  ): Promise<Array<T & { parent: CommentParentPreview | null }>> {
    if (rows.length === 0) return []

    const parentIds = [
      ...new Set(
        rows
          .map((r) => r.parentCommentId)
          .filter((id): id is NonNullable<typeof id> => !!id)
          .map((id) => String(id)),
      ),
    ]

    if (parentIds.length === 0) {
      return rows.map((row) => ({ ...row, parent: null }))
    }

    const parents = await this.commentRepository.findManyByIds(parentIds)
    if (parents.length > 0) {
      await this.fillAndReplaceAvatarUrl(parents as CommentModel[])
    }
    const previewMap = new Map<string, CommentParentPreview>()
    for (const parent of parents) {
      previewMap.set(String(parent.id), this.toParentPreview(parent))
    }

    return rows.map((row) => {
      const pid = row.parentCommentId ? String(row.parentCommentId) : null
      return {
        ...row,
        parent: pid ? (previewMap.get(pid) ?? null) : null,
      }
    })
  }

  private toParentPreview(row: CommentRow): CommentParentPreview {
    return {
      id: String(row.id),
      author: row.author,
      text: row.text,
      isDeleted: row.isDeleted,
    }
  }

  private buildCommentRefSummary(
    type: CollectionRefTypes,
    doc: any,
  ): CommentRefSummary {
    const summary: CommentRefSummary = {
      id: doc.id,
      type,
      title: doc.title,
    }
    if (type === CollectionRefTypes.Note) {
      summary.nid = doc.nid
      summary.slug = doc.slug ?? null
    } else if (type === CollectionRefTypes.Post) {
      summary.slug = doc.slug
      summary.category = doc.category
        ? { name: doc.category.name, slug: doc.category.slug }
        : null
    } else if (type === CollectionRefTypes.Page) {
      summary.slug = doc.slug
    }
    return summary
  }

  async deleteForRef(
    refType: CollectionRefTypes | CommentRefType,
    refId: string,
  ) {
    return this.commentRepository.deleteForRef(refType as CommentRefType, refId)
  }

  async countByRef(
    refType: CollectionRefTypes | CommentRefType,
    refId: string,
  ) {
    return this.commentRepository.countByRef(refType as CommentRefType, refId)
  }

  async countManyByRef(
    refType: CollectionRefTypes | CommentRefType,
    refIds: Array<string>,
  ): Promise<Map<string, number>> {
    return this.commentRepository.countManyByRef(
      refType as CommentRefType,
      refIds,
    )
  }

  async countByState(state: number, rootOnly = false) {
    return this.commentRepository.countByState(state, rootOnly)
  }

  async count() {
    return this.commentRepository.count()
  }

  async findRecent(
    size: number,
    options: { state?: number; rootOnly?: boolean } = {},
  ) {
    return this.commentRepository.findRecent(size, options)
  }

  async createComment(
    id: string,
    doc: Partial<CommentModel>,
    type?: CollectionRefTypes,
  ) {
    const reader = await this.assignReaderToComment()
    if (reader) {
      this.stripReaderIdentitySnapshot(doc)
      this.assignAuthProviderToComment(doc)
    }

    let refType = type
    if (!refType) {
      const result = await this.databaseService.findGlobalById(id)
      if (result) refType = result.type
    }
    if (!refType) throw createAppException(AppErrorCode.COMMENT_POST_NOT_EXISTS)

    const countryCode = await this.commentCountryService.lookupCountryCode(
      doc.ip,
      { cfHint: this.currentCfIpCountryHint() },
    )

    const comment = await this.commentRepository.create({
      text: doc.text!,
      author: doc.author,
      mail: doc.mail,
      url: doc.url,
      avatar: doc.avatar,
      authProvider: doc.authProvider,
      meta: doc.meta as any,
      anchor: doc.anchor as any,
      ip: doc.ip,
      agent: doc.agent,
      location: doc.location,
      isWhispers: doc.isWhispers,
      countryCode,
      state: RequestContext.hasAdminAccess()
        ? CommentState.Read
        : CommentState.Unread,
      refId: id,
      refType: refType as CommentRefType,
      parentCommentId: null,
      rootCommentId: null,
      readerId: reader ? reader.id : undefined,
    })

    await this.invalidateTabCountsCache()
    return comment
  }

  async validAuthorName(author: string): Promise<void> {
    const isExist = await this.ownerService.isOwnerName(author)
    if (isExist) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message:
          "That name belongs to the site owner, and you don't look like them.",
      })
    }
  }

  async replyComment(id: string, doc: Partial<CommentModel>) {
    const parent = await this.commentRepository.findById(id)
    if (!parent) throw createAppException(AppErrorCode.NOT_FOUND)

    const reader = await this.assignReaderToComment()
    if (reader) {
      this.stripReaderIdentitySnapshot(doc)
      this.assignAuthProviderToComment(doc)
    }

    // When the owner replies to an unread comment, mark the parent as read.
    if (
      RequestContext.hasAdminAccess() &&
      parent.state === CommentState.Unread
    ) {
      try {
        await this.commentRepository.update(parent.id, {
          state: CommentState.Read,
        })
      } catch (err) {
        this.logger.warn(
          `auto mark parent ${parent.id} as read failed: ${err instanceof Error ? err.message : err}`,
        )
      }
    }

    const countryCode = await this.commentCountryService.lookupCountryCode(
      doc.ip,
      { cfHint: this.currentCfIpCountryHint() },
    )

    const comment = await this.commentRepository.createReply({
      text: doc.text!,
      author: doc.author,
      mail: doc.mail,
      url: doc.url,
      avatar: doc.avatar,
      authProvider: doc.authProvider,
      meta: doc.meta as any,
      anchor: doc.anchor as any,
      ip: doc.ip,
      agent: doc.agent,
      location: doc.location,
      countryCode,
      // Owner is the only admin-tier identity, so an authenticated reply is
      // an owner reply. Drives the §6.1 awaiting predicate.
      isOwnerReply: RequestContext.hasAdminAccess(),
      state:
        doc.state ??
        (RequestContext.hasAdminAccess()
          ? CommentState.Read
          : CommentState.Unread),
      refId: parent.refId,
      refType: parent.refType,
      parentCommentId: parent.id,
      rootCommentId: parent.rootCommentId || parent.id,
      isWhispers: parent.isWhispers,
      readerId: reader ? reader.id : undefined,
    })
    await this.invalidateTabCountsCache()
    return comment
  }

  async softDeleteComment(id: string) {
    const comment = await this.commentRepository.findById(id)
    if (!comment) throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)
    if (comment.isDeleted) return
    await this.commentRepository.update(id, {
      isDeleted: true,
      text: COMMENT_DELETED_PLACEHOLDER,
      editedAt: new Date(),
    })
    await this.invalidateTabCountsCache()
    try {
      await this.fileReferenceService.hardDeleteFilesForComment(
        id,
        FileDeletionReason.CommentDeleted,
      )
    } catch (err) {
      this.logger.warn(
        `cascade file delete after comment ${id} delete failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  async allowComment(id: string, _type?: CollectionRefTypes) {
    const result = await this.databaseService.findGlobalById(id)
    if (!result) throw createAppException(AppErrorCode.NOT_FOUND)
    return 'allowComment' in result.document
      ? (result.document as any).allowComment
      : true
  }

  async allowCommentByCommentId(commentId: string) {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw createAppException(AppErrorCode.NOT_FOUND)
    return this.allowComment(
      comment.refId,
      comment.refType as CollectionRefTypes,
    )
  }

  async getComments({
    page,
    size,
    filter = {},
  }: {
    page: number
    size: number
    filter?: CommentFindFilter
  }) {
    const normalizedFilter = this.normalizeListFilter(filter)
    const queryList = await this.commentRepository.paginatedFind(
      normalizedFilter,
      page,
      size,
    )
    await this.fillAndReplaceAvatarUrl(queryList.data)
    const dataWithRef = await this.attachRef(queryList.data)
    const dataWithParent = await this.attachParentPreview(dataWithRef)
    const dataWithCountry = await this.enrichCommentsWithCountry(dataWithParent)
    return { ...queryList, data: dataWithCountry }
  }

  /**
   * Translate the legacy numeric `state` parameter to its `tab` equivalent
   * when callers pass `state` without `tab` (spec §6.2). Emits a one-shot
   * deprecation warning per process so logs do not flood under a busy admin
   * page. `tab` is the source of truth — when both are supplied, `state` is
   * dropped before the repository sees it.
   */
  private normalizeListFilter(filter: CommentFindFilter): CommentFindFilter {
    if (filter.tab) {
      const { state: _ignored, ...rest } = filter
      void _ignored
      return rest
    }
    if (filter.state !== undefined && filter.state in DEFAULT_STATE_TO_TAB) {
      if (!this.deprecatedStateWarned) {
        this.deprecatedStateWarned = true
        console.warn(
          '[comment] GET /comments?state= is deprecated; use ?tab= instead.',
        )
      }
      const { state, ...rest } = filter
      return { ...rest, tab: DEFAULT_STATE_TO_TAB[state as number] }
    }
    return filter
  }

  /**
   * Tab counts (spec §6.1). Redis-backed 30s cache keyed on `(refType, refId)`.
   * Mutations that touch `state`/`is_deleted`/`is_whispers` invalidate the
   * whole `comment:tab-counts:*` namespace via `invalidateTabCountsCache`.
   */
  async getTabCounts(
    filter: CommentTabCountsFilter = {},
  ): Promise<CommentTabCounts> {
    const key = this.tabCountsKey(filter)
    const cached = await this.readJsonCache<CommentTabCounts>(key)
    if (cached) return cached

    const counts = await this.commentRepository.getTabCounts(filter)
    await this.writeJsonCache(key, counts, TAB_COUNTS_TTL_SECONDS)
    return counts
  }

  /**
   * Author activity panel (spec §6.3). Redis-backed 5min cache keyed on
   * `(mail, ip)`. Threat level is derived from the same query so the
   * sidebar renders without follow-up round trips.
   */
  async getAuthorActivity(
    filter: AuthorActivityFilter,
  ): Promise<AuthorActivity> {
    if (!filter.mail && !filter.ip) {
      throw createAppException(AppErrorCode.VALIDATION_FAILED, {
        issues: [
          {
            code: 'custom',
            path: ['mail'],
            message: 'At least one of mail or ip must be provided',
          },
        ],
      })
    }
    const key = this.authorActivityKey(filter)
    const cached = await this.readJsonCache<AuthorActivity>(key)
    if (cached) return cached

    const raw = await this.commentRepository.getAuthorActivity(filter)
    const threat = this.computeThreatLevel(raw)
    const result: AuthorActivity = {
      totalCount: raw.totalCount,
      firstSeenAt: raw.firstSeenAt,
      lastSeenAt: raw.lastSeenAt,
      items: raw.items,
      threatLevel: threat.level,
      ...(threat.reason ? { threatReason: threat.reason } : {}),
    }
    await this.writeJsonCache(key, result, AUTHOR_ACTIVITY_TTL_SECONDS)
    return result
  }

  /**
   * Batch country-code enrichment (spec §6.4). Unique IPs are resolved via
   * `CommentCountryService` (Redis-cached per-IP for 30 days); a row's
   * persisted `countryCode` is preferred when present so most reads stay
   * lookup-free.
   */
  async enrichCommentsWithCountry<
    T extends Pick<CommentRow, 'ip' | 'countryCode'>,
  >(rows: T[]): Promise<T[]> {
    if (rows.length === 0) return rows
    const missingIps = new Set<string>()
    for (const row of rows) {
      if (!row.countryCode && row.ip) missingIps.add(row.ip)
    }
    if (missingIps.size === 0) return rows

    const resolved = new Map<string, string | null>()
    await Promise.all(
      [...missingIps].map(async (ip) => {
        const code = await this.commentCountryService.lookupCountryCode(ip)
        resolved.set(ip, code)
      }),
    )

    for (const row of rows) {
      if (!row.countryCode && row.ip) {
        const code = resolved.get(row.ip)
        if (code) row.countryCode = code
      }
    }
    return rows
  }

  private computeThreatLevel(raw: {
    totalCount: number
    junkInLast30Days: number
    sameNetJunkInLast7Days: number
    items: ReadonlyArray<{ state: number }>
  }): { level: AuthorThreatLevel; reason?: string } {
    const everJunk = raw.items.some((item) => item.state === CommentState.Junk)
    if (everJunk) {
      return {
        level: 'risk',
        reason: 'Author has been flagged as junk before.',
      }
    }
    if (raw.sameNetJunkInLast7Days >= 3) {
      return {
        level: 'risk',
        reason: 'Same /24 IP block had 3+ junk comments in the last 7 days.',
      }
    }
    if (raw.junkInLast30Days === 0 && raw.totalCount >= 3) {
      return {
        level: 'trusted',
        reason: 'No junk in the last 30 days and 3+ historical comments.',
      }
    }
    return { level: 'neutral' }
  }

  private tabCountsKey(filter: CommentTabCountsFilter): string {
    const refType = filter.refType ?? '*'
    const refId = filter.refId ?? '*'
    return `${TAB_COUNTS_KEY_PREFIX}${refType}:${refId}`
  }

  private authorActivityKey(filter: AuthorActivityFilter): string {
    const mail = filter.mail ?? ''
    const ip = filter.ip ?? ''
    return `${AUTHOR_ACTIVITY_KEY_PREFIX}${mail}:${ip}`
  }

  /**
   * Invalidate every cached tab-counts entry. Called from every mutation
   * that flips `state`, `is_deleted`, or `is_whispers` (spec §6.1). A full
   * pattern delete is cheaper than tracking per-ref cache fanout because
   * each entry is 6 ints with a 30s TTL.
   */
  async invalidateTabCountsCache(): Promise<void> {
    try {
      const client = this.redisService.getClient()
      const keys = await client.keys(`${TAB_COUNTS_KEY_PREFIX}*`)
      if (keys.length === 0) return
      await Promise.all(keys.map((key) => client.del(key)))
    } catch (err) {
      this.logger.warn(
        `tab-counts cache invalidation failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  private async readJsonCache<T>(key: string): Promise<T | null> {
    try {
      const client = this.redisService.getClient()
      const raw = await client.get(key)
      if (!raw) return null
      return JSON.parse(raw, this.reviveDate) as T
    } catch (err) {
      this.logger.debug(
        `cache read failed for ${key}: ${err instanceof Error ? err.message : err}`,
      )
      return null
    }
  }

  private async writeJsonCache<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const client = this.redisService.getClient()
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (err) {
      this.logger.debug(
        `cache write failed for ${key}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  // Restore Date instances on cache read so callers (e.g. the controller's
  // view layer) see the same wall-clock value they originally serialized.
  private reviveDate(_key: string, value: unknown): unknown {
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return value
  }

  async getSourceCandidates(options: {
    refType?: CommentRefType
    search?: string
    size?: number
  }): Promise<CommentSourceCandidateSummary[]> {
    const candidates = await this.commentRepository.findSourceCandidates({
      refType: options.refType,
      size: options.search ? 100 : options.size,
    })
    const rows = candidates.map((candidate) => ({
      id: `${candidate.refType}:${candidate.refId}`,
      refType: candidate.refType,
      refId: candidate.refId,
      count: candidate.count,
      latestCommentAt: candidate.latestCommentAt,
    }))
    const withRef = await this.attachRef(rows)
    const search = options.search?.trim().toLowerCase()

    return withRef
      .flatMap((row) => {
        if (!row.ref) return []
        const title = row.ref.title ?? ''
        if (search && !title.toLowerCase().includes(search)) return []
        return [
          {
            ...row.ref,
            commentCount: row.count,
            latestCommentAt: row.latestCommentAt,
          },
        ]
      })
      .slice(0, options.size ?? 30)
  }

  async getAdminThreadForComment(id: string) {
    const selected = await this.commentRepository.findById(id)
    if (!selected) return null
    const rootId = String(selected.rootCommentId ?? selected.id)
    const thread = await this.commentRepository.findAdminThreadByRoot(rootId)
    const withRef = await this.attachRef(thread)
    const withParents = await this.attachParentPreview(withRef)
    await this.fillAndReplaceAvatarUrl(withParents as CommentModel[])

    const root =
      withParents.find((comment) => String(comment.id) === rootId) ?? null
    const currentFromThread =
      withParents.find((comment) => String(comment.id) === id) ?? null
    const current = currentFromThread ?? selected

    return {
      currentCommentId: String(id),
      rootCommentId: rootId,
      root,
      thread: withParents,
      current,
      ref: root?.ref ?? currentFromThread?.ref ?? null,
    }
  }

  async getCommentsByRefId(
    refId: string,
    {
      page,
      size,
      isAuthenticated,
      commentShouldAudit,
      hasAnchor = false,
      sort = 'pinned',
      around,
    }: {
      page: number
      size: number
      isAuthenticated: boolean
      commentShouldAudit: boolean
      hasAnchor?: boolean
      sort?: 'pinned' | 'newest' | 'oldest'
      around?: string
    },
  ) {
    const result = await this.commentRepository.findRootThreadsByRef(refId, {
      page,
      size,
      isAuthenticated,
      commentShouldAudit,
      hasAnchor,
      sort,
      around,
    })

    const rootIds = result.data.map((comment) => comment.id)
    const replies = await this.commentRepository.findVisibleRepliesForRoots(
      rootIds,
      {
        isAuthenticated,
        commentShouldAudit,
      },
    )
    const repliesByRootId = new Map<string, CommentModel[]>()
    for (const reply of replies) {
      const rootId = reply.rootCommentId
      if (!rootId) continue
      const current = repliesByRootId.get(rootId) ?? []
      current.push(reply as CommentModel)
      repliesByRootId.set(rootId, current)
    }

    const dataWithRef = await this.attachRef(result.data)
    const data = dataWithRef.map((comment) => {
      const threadReplies = repliesByRootId.get(comment.id) ?? []
      const { replies, replyWindow } = this.buildReplyWindow(threadReplies)
      return {
        ...comment,
        rootCommentId: comment.rootCommentId ?? null,
        parentCommentId: comment.parentCommentId ?? null,
        replies,
        replyWindow,
      }
    })

    await this.fillAndReplaceAvatarUrl([
      ...(data as CommentModel[]),
      ...data.flatMap((comment) => comment.replies),
    ])
    return {
      ...result,
      data,
    }
  }

  async getThreadReplies(
    rootCommentId: string,
    {
      cursor,
      size = COMMENT_THREAD_BATCH_SIZE,
      isAuthenticated,
      commentShouldAudit,
    }: {
      cursor?: string
      size?: number
      isAuthenticated: boolean
      commentShouldAudit: boolean
    },
  ) {
    const replies = await this.commentRepository.findVisibleRepliesForRoot(
      rootCommentId,
      {
        isAuthenticated,
        commentShouldAudit,
      },
    )

    const total = replies.length
    if (total <= COMMENT_REPLY_THRESHOLD) {
      await this.fillAndReplaceAvatarUrl(replies)
      return { replies, remaining: 0, done: true }
    }

    const headSize = Math.min(COMMENT_REPLY_EDGE_SIZE, total)
    const tailStart = Math.max(headSize, total - COMMENT_REPLY_EDGE_SIZE)
    const middleStart = headSize
    const middleEnd = tailStart

    let startIndex = middleStart
    if (cursor) {
      const cursorIndex = replies.findIndex((reply) => reply.id === cursor)
      if (cursorIndex >= middleStart) startIndex = cursorIndex + 1
    }

    const nextReplies = replies.slice(
      startIndex,
      Math.min(startIndex + size, middleEnd),
    )
    await this.fillAndReplaceAvatarUrl(nextReplies)

    const consumedEnd = startIndex + nextReplies.length

    return {
      replies: nextReplies,
      nextCursor: nextReplies.at(-1)?.id,
      remaining: Math.max(0, middleEnd - consumedEnd),
      done: consumedEnd >= middleEnd,
    }
  }

  private buildReplyWindow(replies: CommentModel[]) {
    if (replies.length <= COMMENT_REPLY_THRESHOLD) {
      return {
        replies,
        replyWindow: {
          total: replies.length,
          returned: replies.length,
          threshold: COMMENT_REPLY_THRESHOLD,
          hasHidden: false,
          hiddenCount: 0,
        },
      }
    }

    const head = replies.slice(0, COMMENT_REPLY_EDGE_SIZE)
    const tail = replies.slice(-COMMENT_REPLY_EDGE_SIZE)
    const selected = [...head]

    const seen = new Set(head.map((reply) => reply.id))
    for (const reply of tail) {
      if (!seen.has(reply.id)) selected.push(reply)
    }

    return {
      replies: selected,
      replyWindow: {
        total: replies.length,
        returned: selected.length,
        threshold: COMMENT_REPLY_THRESHOLD,
        hasHidden: true,
        hiddenCount: replies.length - selected.length,
        nextCursor: head.at(-1)?.id,
      },
    }
  }

  collectThreadReaderIds(
    comments: Array<CommentModel & { replies?: CommentModel[] }>,
  ) {
    const readerIds = new Set<string>()
    const collect = (comment: CommentModel & { replies?: CommentModel[] }) => {
      if (comment.readerId) readerIds.add(comment.readerId)
      comment.replies?.forEach((reply) => collect(reply as any))
    }
    comments.forEach((comment) => collect(comment))
    return [...readerIds]
  }

  async fillAndReplaceAvatarUrl(comments: CommentModel[]) {
    const owner = await this.ownerService.getOwner()
    const readerIds = new Set<string>()
    comments.forEach(function collect(comment) {
      if (typeof comment == 'string') return
      if (comment.readerId) readerIds.add(comment.readerId)
      ;(
        comment as CommentModel & { replies?: CommentModel[] }
      ).replies?.forEach((child) => collect(child as CommentModel))
    })

    const readers = readerIds.size
      ? await this.readerService.findReaderInIds([...readerIds])
      : []
    const readerMap = new Map<string, ReaderModel>()
    readers.forEach((reader) => {
      const id = (reader as any).id || (reader as any).id?.toString?.()
      if (id) readerMap.set(id, reader)
    })

    comments.forEach(function process(comment) {
      if (typeof comment == 'string') return
      const reader = comment.readerId ? readerMap.get(comment.readerId) : null
      if (reader) {
        const isOwner = reader.role === 'owner'
        // Reader.name may be null (better-auth users created via OAuth without
        // a profile name, manual signup with empty name, etc). Walk a robust
        // fallback chain so admin notifications never render "null: <text>".
        const readerDisplay =
          reader.name ||
          reader.displayUsername ||
          reader.username ||
          (reader as any).handle ||
          (reader.email ? reader.email.split('@')[0] : null)
        comment.author =
          isOwner && owner.name
            ? owner.name
            : readerDisplay || comment.author || 'Anonymous'
        comment.avatar =
          (isOwner ? owner.avatar : undefined) ||
          reader.image ||
          getAvatar(reader.email ?? undefined)
      }
      if (comment.author === owner.name) {
        comment.avatar = owner.avatar || comment.avatar
      }
      if (!comment.avatar) comment.avatar = getAvatar(comment.mail)
      ;(
        comment as CommentModel & { replies?: CommentModel[] }
      ).replies?.forEach((child) => process(child as CommentModel))
    })
    return comments
  }

  async updateComment(
    id: string,
    patch: Partial<{
      text: string
      state: number
      pin: boolean
      isDeleted: boolean
      isWhispers: boolean
      meta: string | null
      anchor: Record<string, unknown> | null
      editedAt: Date | null
      location: string | null
    }>,
  ) {
    const result = await this.commentRepository.update(id, patch)
    if (
      patch.state !== undefined ||
      patch.isDeleted !== undefined ||
      patch.isWhispers !== undefined
    ) {
      await this.invalidateTabCountsCache()
    }
    return result
  }

  async clearPinForRefOfComment(id: string) {
    const comment = await this.commentRepository.findById(id)
    if (!comment) return
    const comments = await this.commentRepository.paginatedFind(
      { refId: comment.refId, refType: comment.refType },
      1,
      50,
    )
    await Promise.all(
      comments.data.map((item) =>
        this.commentRepository.update(item.id, { pin: false }),
      ),
    )
  }

  async updateStateBulk(ids: string[], state: number) {
    const affected = await this.commentRepository.updateStateBulk(ids, state)
    if (affected > 0) await this.invalidateTabCountsCache()
    return affected
  }

  async updateStateByFilter(filter: CommentFindFilter, state: number) {
    const affected = await this.commentRepository.updateStateByFilter(
      this.normalizeListFilter(filter),
      state,
    )
    if (affected > 0) await this.invalidateTabCountsCache()
    return affected
  }

  async findByFilter(filter: CommentFindFilter) {
    return this.commentRepository.findByFilter(this.normalizeListFilter(filter))
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  async handlePostUpdate(payload: { id?: string }) {
    void payload
  }

  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleNoteUpdate(payload: { id?: string }) {
    void payload
  }

  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async handlePageUpdate(payload: { id?: string }) {
    void payload
  }

  async editComment(id: string, text: string) {
    const comment = await this.commentRepository.findById(id)
    if (!comment) throw createAppException(AppErrorCode.NOT_FOUND)
    if (comment.isDeleted)
      throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)
    await this.commentRepository.update(id, { text, editedAt: new Date() })
    await this.eventManager.broadcast(
      BusinessEvents.COMMENT_UPDATE,
      { id, text },
      {
        scope: comment.isWhispers ? EventScope.TO_SYSTEM_ADMIN : EventScope.ALL,
      },
    )
  }
}
