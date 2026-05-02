import { forwardRef, Inject, Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { debounce, omit } from 'es-toolkit/compat'
import slugify from 'slugify'

import {
  BizException,
  BusinessException,
} from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { isLexical } from '~/utils/content.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getLessThanNow } from '~/utils/time.util'
import { isDefined } from '~/utils/validator.util'

import { AiSlugBackfillService } from '../ai/ai-writer/ai-slug-backfill.service'
import { CommentService } from '../comment/comment.service'
import { DraftRefType } from '../draft/draft.model'
import { DraftService } from '../draft/draft.service'
import { SlugTrackerService } from '../slug-tracker/slug-tracker.service'
import { NoteModel } from './note.model'
import { NoteRepository, type NoteRow } from './note.repository'

@Injectable()
export class NoteService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly imageService: ImageService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly eventManager: EventManagerService,
    private readonly lexicalService: LexicalService,
    private readonly slugTrackerService: SlugTrackerService,
    private readonly aiSlugBackfillService: AiSlugBackfillService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    @Inject(forwardRef(() => DraftService))
    private readonly draftService: DraftService,
  ) {}

  public get repository() {
    return this.noteRepository
  }

  public readonly publicNoteQueryCondition = { isPublished: true }

  toLegacy(row: NoteRow | null): any {
    if (!row) return null
    const plain: any = {
      ...row,
      _id: row.id,
      created: row.createdAt,
      modified: row.modifiedAt,
      updated: row.modifiedAt,
      secret: row.publicAt,
      password: row.hasPassword ? '*' : null,
      count: { read: row.readCount, like: row.likeCount },
      commentsIndex: 0,
      allowComment: true,
      topic: row.topic
        ? {
            ...row.topic,
            _id: row.topic.id,
          }
        : row.topic,
    }
    plain.toObject = () => ({ ...plain, toObject: undefined })
    return plain
  }

  toLegacyMany(rows: NoteRow[]) {
    return rows.map((row) => this.toLegacy(row))
  }

  toPaginate(result: Awaited<ReturnType<NoteRepository['listVisible']>>) {
    return {
      docs: this.toLegacyMany(result.data),
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      totalPages: result.pagination.totalPage,
      limit: result.pagination.size,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  }

  private normalizeMeta(meta: unknown) {
    if (meta === undefined) return undefined
    if (meta === null) return null
    if (typeof meta === 'string') return JSON.safeParse(meta) ?? null
    return meta as Record<string, unknown>
  }

  public checkNoteIsSecret(note: NoteModel | any) {
    if (!note.publicAt && !note.secret) return false
    return dayjs(note.publicAt ?? note.secret).isAfter(new Date())
  }

  private normalizeSlug(slug?: string | null) {
    if (!slug) return undefined
    const normalized = slugify(slug, { lower: true, strict: true, trim: true })
    return normalized || undefined
  }

  private getDateRange(year: number, month: number, day: number) {
    const start = new Date(Date.UTC(year, month - 1, day))
    const end = new Date(Date.UTC(year, month - 1, day + 1))
    return { start, end }
  }

  private isDateWithinRange(
    date: Date | string,
    year: number,
    month: number,
    day: number,
  ) {
    const { start, end } = this.getDateRange(year, month, day)
    const value = new Date(date)
    return value >= start && value < end
  }

  public buildSeoPath(note: Pick<NoteModel, 'created' | 'slug'>) {
    const normalizedSlug = this.normalizeSlug(note.slug)
    if (!normalizedSlug || !note.created) return null
    const date = new Date(note.created)
    return `/notes/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}/${normalizedSlug}`
  }

  public buildPublicPath(note: Pick<NoteModel, 'created' | 'slug' | 'nid'>) {
    return this.buildSeoPath(note) ?? `/notes/${note.nid}`
  }

  private async ensureSlugAvailable(slug?: string, excludeId?: string) {
    if (!slug) return
    const existing = await this.noteRepository.findBySlug(slug)
    if (!existing) return
    if (excludeId && existing.id === excludeId) return
    throw new BusinessException(ErrorCodeEnum.SlugNotAvailable)
  }

  private async trackSeoPathChanges(
    oldDocument: NoteModel,
    nextState: Pick<NoteModel, 'created' | 'slug'>,
    targetId: string,
  ) {
    const oldPath = this.buildSeoPath(oldDocument)
    const nextPath = this.buildSeoPath(nextState)
    if (!oldPath || oldPath === nextPath) return
    return this.slugTrackerService.createTracker(
      oldPath,
      ArticleTypeEnum.Note,
      targetId,
    )
  }

  async findById(id: string) {
    return this.toLegacy(await this.noteRepository.findById(id))
  }

  async findByNid(nid: number) {
    return this.toLegacy(await this.noteRepository.findByNid(nid))
  }

  async findBySlug(slug: string) {
    return this.toLegacy(await this.noteRepository.findBySlug(slug))
  }

  async findManyByIds(ids: string[]) {
    return this.toLegacyMany(await this.noteRepository.findManyByIds(ids))
  }

  async findRecent(size: number, options: { visibleOnly?: boolean } = {}) {
    return this.toLegacyMany(
      await this.noteRepository.findRecent(size, options),
    )
  }

  async listPaginated(
    page: number,
    size: number,
    options: { visibleOnly?: boolean } = {},
  ) {
    return this.toPaginate(
      options.visibleOnly
        ? await this.noteRepository.listVisible(page, size)
        : await this.noteRepository.listAll(page, size),
    )
  }

  async count() {
    return this.noteRepository.count()
  }

  async countVisible() {
    return this.noteRepository.countVisible()
  }

  async findAdjacent(
    direction: 'before' | 'after',
    pivot: { nid: number },
    options: { visibleOnly?: boolean } = {},
  ) {
    return this.toLegacy(
      await this.noteRepository.findAdjacent(direction, pivot, options),
    )
  }

  async findByCreatedWindow(
    pivotDate: Date,
    direction: 'before' | 'after',
    limit: number,
    options: { visibleOnly?: boolean } = {},
  ) {
    return this.toLegacyMany(
      await this.noteRepository.findByCreatedWindow(
        pivotDate,
        direction,
        limit,
        options,
      ),
    )
  }

  async findOneByDateAndSlug(
    year: number,
    month: number,
    day: number,
    slug: string,
    _options?: { includeLocation?: boolean },
  ) {
    const normalizedSlug = this.normalizeSlug(slug)
    if (!normalizedSlug) throw new BizException(ErrorCodeEnum.InvalidSlug)

    const { start, end } = this.getDateRange(year, month, day)
    const direct = await this.noteRepository.findOneByDateAndSlug(
      start,
      end,
      normalizedSlug,
    )
    if (direct) return this.toLegacy(direct)

    const tracked = await this.slugTrackerService.findTrackerBySlug(
      `/notes/${year}/${month}/${day}/${normalizedSlug}`,
      ArticleTypeEnum.Note,
    )
    if (!tracked) return null

    const trackedDocument = await this.findById(tracked.targetId)
    if (!trackedDocument) return null
    if (!this.isDateWithinRange(trackedDocument.created!, year, month, day)) {
      return null
    }
    return trackedDocument
  }

  async getLatestNoteId() {
    const note = await this.noteRepository.getLatestVisible()
    if (!note) throw new CannotFindException()
    return { nid: note.nid, id: note.id }
  }

  async getLatestOne(
    condition: { isPublished?: boolean } = {},
    _projection: any = undefined,
  ) {
    const [latest] = await this.findRecent(1, {
      visibleOnly: condition.isPublished === true,
    })
    if (!latest) return null
    const [next] = await this.findByCreatedWindow(latest.created, 'before', 1, {
      visibleOnly: condition.isPublished === true,
    })
    return { latest, next }
  }

  checkPasswordToAccess<T extends NoteModel>(doc: T, password?: string) {
    if (!(doc as any).password || (doc as any).password === '*') return true
    if (!password) return false
    return Object.is(password, (doc as any).password)
  }

  public async create(document: NoteModel & { draftId?: string }) {
    this.lexicalService.populateText(document)
    const { draftId } = document
    const normalizedSlug = this.normalizeSlug(document.slug)
    await this.ensureSlugAvailable(normalizedSlug)
    if (normalizedSlug) document.slug = normalizedSlug

    const note = this.toLegacy(
      await this.noteRepository.create({
        nid: document.nid ?? (await this.noteRepository.nextNid()),
        title: document.title,
        slug: normalizedSlug,
        text: document.text,
        content: document.content,
        contentFormat: document.contentFormat ?? ContentFormat.Markdown,
        images: document.images as unknown[],
        meta: this.normalizeMeta(document.meta) as Record<
          string,
          unknown
        > | null,
        isPublished: document.isPublished,
        password: document.password,
        publicAt: document.publicAt,
        mood: document.mood,
        weather: document.weather,
        bookmark: document.bookmark,
        coordinates: document.coordinates,
        location: document.location,
        topicId: document.topicId as string | undefined,
      }),
    )

    if (document.created) {
      await this.noteRepository.update(note.id, {
        createdAt: getLessThanNow(document.created),
      })
    }

    if (draftId) {
      await this.fileReferenceService.removeReferencesForDocument(
        draftId,
        FileReferenceType.Draft,
      )
      await this.draftService.linkToPublished(draftId, note.id)
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      await this.fileReferenceService.activateReferences(
        note,
        note.id,
        FileReferenceType.Note,
      )
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.emit(
          BusinessEvents.NOTE_CREATE,
          { id: note.id },
          { scope: EventScope.TO_SYSTEM_VISITOR },
        ),
        !normalizedSlug &&
          this.aiSlugBackfillService
            .createBackfillTaskForNotes([note.id])
            .catch(() => undefined),
        !isLexical(note) &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            note.text,
            note.images,
            async (images) => {
              await this.noteRepository.setImages(note.id, images)
            },
          ),
      ])
    })

    return note
  }

  public async updateById(
    id: string,
    data: Partial<NoteModel> & { draftId?: string },
  ) {
    this.lexicalService.populateText(data as any)
    const oldDoc = await this.findById(id)
    if (!oldDoc) throw new NoContentCanBeModifiedException()

    const { draftId } = data
    const hasSlugInput = Object.prototype.hasOwnProperty.call(data, 'slug')
    const normalizedSlug = hasSlugInput
      ? this.normalizeSlug(data.slug ?? undefined)
      : undefined
    if (hasSlugInput && normalizedSlug && normalizedSlug !== oldDoc.slug) {
      await this.ensureSlugAvailable(normalizedSlug, id)
    }

    const hasFieldChanged = (
      ['title', 'text', 'mood', 'weather', 'meta', 'topicId', 'slug'] as const
    ).some((key) => {
      if (key === 'slug' && hasSlugInput) return normalizedSlug !== oldDoc.slug
      return isDefined(data[key]) && data[key] !== oldDoc[key]
    })
    const hasContentChanged = ['title', 'text'].some((key) =>
      isDefined(data[key as keyof NoteModel]),
    )

    const patch = omit(data, NoteModel.protectedKeys.concat('slug' as any))
    const updated = this.toLegacy(
      await this.noteRepository.update(id, {
        title: patch.title,
        slug: hasSlugInput ? normalizedSlug : undefined,
        text: patch.text,
        content: patch.content,
        contentFormat: patch.contentFormat,
        images: patch.images as unknown[] | undefined,
        meta:
          patch.meta !== undefined
            ? (this.normalizeMeta(patch.meta) as Record<string, unknown> | null)
            : undefined,
        isPublished: patch.isPublished,
        password: patch.password,
        publicAt: patch.publicAt,
        mood: patch.mood,
        weather: patch.weather,
        bookmark: patch.bookmark,
        coordinates: patch.coordinates,
        location: patch.location,
        topicId: patch.topicId as string | undefined,
        createdAt: data.created ? getLessThanNow(data.created) : undefined,
        modifiedAt:
          hasContentChanged || hasFieldChanged ? new Date() : undefined,
      }),
    )
    if (!updated) throw new NoContentCanBeModifiedException()

    await this.trackSeoPathChanges(
      oldDoc as NoteModel,
      {
        created: (data.created as Date | undefined) ?? oldDoc.created,
        slug: hasSlugInput ? normalizedSlug : oldDoc.slug,
      } as Pick<NoteModel, 'created' | 'slug'>,
      id,
    )

    if (draftId) await this.draftService.markAsPublished(draftId)

    scheduleManager.schedule(async () => {
      await this.fileReferenceService.updateReferencesForDocument(
        updated,
        updated.id,
        FileReferenceType.Note,
      )
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        !isLexical(updated) &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            updated.text,
            updated.images,
            async (images) => {
              await this.noteRepository.setImages(id, images)
            },
          ),
      ])
    })

    await this.broadcastNoteUpdateEvent(updated)
    return updated
  }

  private broadcastNoteUpdateEvent = debounce(
    async (updated: NoteModel) => {
      if (!updated) return
      this.eventManager.emit(
        BusinessEvents.NOTE_UPDATE,
        { id: updated.id },
        { scope: EventScope.TO_SYSTEM_VISITOR },
      )
    },
    1000,
    { leading: false },
  )

  async deleteById(id: string) {
    const doc = await this.findById(id)
    if (!doc) return
    await Promise.all([
      this.noteRepository.deleteById(id),
      this.commentService.deleteForRef(CollectionRefTypes.Note, id),
      this.draftService.deleteByRef(DraftRefType.Note, id),
      this.fileReferenceService.removeReferencesForDocument(
        id,
        FileReferenceType.Note,
      ),
      this.slugTrackerService.deleteAllTracker(id),
    ])
    scheduleManager.schedule(async () => {
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.emit(
          BusinessEvents.NOTE_DELETE,
          { id },
          { scope: EventScope.TO_SYSTEM_VISITOR },
        ),
      ])
    })
  }

  async getIdByNid(nid: number) {
    const document = await this.noteRepository.findByNid(nid)
    return document?.id ?? null
  }

  async findOneByIdOrNid(unique: any) {
    if (!/^\d{15,}$/.test(String(unique))) {
      const byNid = await this.noteRepository.findByNid(Number(unique))
      if (byNid) return this.toLegacy(byNid)
    }
    return this.findById(String(unique))
  }

  async getNotePaginationByTopicId(
    topicId: string,
    pagination: { page?: number; limit?: number } = {},
    condition?: { isPublished?: boolean },
  ) {
    const { page = 1, limit = 10 } = pagination
    return this.toPaginate(
      await this.noteRepository.listByTopicId(topicId, page, limit, {
        visibleOnly: condition?.isPublished === true,
      }),
    )
  }

  async getTopicRecentUpdate(topicId: string, isAuthenticated: boolean) {
    return this.noteRepository.getTopicRecentUpdate(topicId, {
      visibleOnly: !isAuthenticated,
    })
  }
}
