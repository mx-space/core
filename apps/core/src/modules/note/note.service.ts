import { forwardRef, Inject, Injectable } from '@nestjs/common'
import type { DocumentType } from '@typegoose/typegoose'
import dayjs from 'dayjs'
import { debounce, omit } from 'es-toolkit/compat'
import type { PaginateOptions, QueryFilter } from 'mongoose'
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
import { InjectModel } from '~/transformers/model.transformer'
import { isLexical } from '~/utils/content.util'
import { dbTransforms } from '~/utils/db-transform.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getLessThanNow } from '~/utils/time.util'
import { isDefined, isMongoId } from '~/utils/validator.util'

import { AiSlugBackfillService } from '../ai/ai-writer/ai-slug-backfill.service'
import { CommentService } from '../comment/comment.service'
import { DraftRefType } from '../draft/draft.model'
import { DraftService } from '../draft/draft.service'
import { SlugTrackerService } from '../slug-tracker/slug-tracker.service'
import { NoteModel } from './note.model'

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
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

  public get model() {
    return this.noteModel
  }

  public readonly publicNoteQueryCondition = {
    isPublished: true,
    $and: [
      {
        $or: [
          {
            password: '',
          },
          {
            password: undefined,
          },
        ],
      },
      {
        $or: [
          {
            secret: undefined,
          },
          {
            secret: {
              $lt: new Date(),
            },
          },
        ],
      },
    ],
  }

  public checkNoteIsSecret(note: NoteModel) {
    if (!note.publicAt) {
      return false
    }
    return dayjs(note.publicAt).isAfter(new Date())
  }

  private normalizeSlug(slug?: string | null) {
    if (!slug) {
      return undefined
    }

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
    if (!normalizedSlug || !note.created) {
      return null
    }

    const date = new Date(note.created)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    const day = date.getUTCDate()

    return `/notes/${year}/${month}/${day}/${normalizedSlug}`
  }

  public buildPublicPath(note: Pick<NoteModel, 'created' | 'slug' | 'nid'>) {
    return this.buildSeoPath(note) ?? `/notes/${note.nid}`
  }

  private async ensureSlugAvailable(slug?: string, excludeId?: string) {
    if (!slug) {
      return
    }

    const existing = await this.noteModel.findOne({ slug }).lean()
    if (!existing) {
      return
    }

    const existingId = existing.id ?? existing._id?.toString?.()
    if (excludeId && existingId === excludeId) {
      return
    }

    throw new BusinessException(ErrorCodeEnum.SlugNotAvailable)
  }

  private async trackSeoPathChanges(
    oldDocument: NoteModel,
    nextState: Pick<NoteModel, 'created' | 'slug'>,
    targetId: string,
  ) {
    const oldPath = this.buildSeoPath(oldDocument)
    const nextPath = this.buildSeoPath(nextState)

    if (!oldPath || oldPath === nextPath) {
      return
    }

    return this.slugTrackerService.createTracker(
      oldPath,
      ArticleTypeEnum.Note,
      targetId,
    )
  }

  async findOneByDateAndSlug(
    year: number,
    month: number,
    day: number,
    slug: string,
    options?: { includeLocation?: boolean },
  ) {
    const normalizedSlug = this.normalizeSlug(slug)
    if (!normalizedSlug) {
      throw new BizException(ErrorCodeEnum.InvalidSlug)
    }

    const { start, end } = this.getDateRange(year, month, day)
    const protectedSelect = `+password ${
      options?.includeLocation ? '+location +coordinates' : ''
    }`

    const direct = await this.noteModel
      .findOne({
        slug: normalizedSlug,
        created: {
          $gte: start,
          $lt: end,
        },
      })
      .select(protectedSelect)
      .lean({ getters: true, autopopulate: true })

    if (direct) {
      return direct
    }

    const tracked = await this.slugTrackerService.findTrackerBySlug(
      `/notes/${year}/${month}/${day}/${normalizedSlug}`,
      ArticleTypeEnum.Note,
    )

    if (!tracked) {
      return null
    }

    const trackedDocument = await this.noteModel
      .findById(tracked.targetId)
      .select(protectedSelect)
      .lean({ getters: true, autopopulate: true })

    if (!trackedDocument) {
      return null
    }

    if (!this.isDateWithinRange(trackedDocument.created!, year, month, day)) {
      return null
    }

    return trackedDocument
  }

  async getLatestNoteId() {
    const note = await this.noteModel
      .findOne()
      .sort({
        created: -1,
      })
      .lean()
    if (!note) {
      throw new CannotFindException()
    }
    return {
      nid: note.nid,
      id: note.id,
    }
  }
  async getLatestOne(
    condition: QueryFilter<DocumentType<NoteModel>> = {},
    projection: any = undefined,
  ) {
    const latest: NoteModel | null = await this.noteModel
      .findOne(condition, projection)
      .sort({
        created: -1,
      })
      .lean({
        getters: true,
        autopopulate: true,
      })

    if (!latest) {
      return null
    }

    // 是否存在上一条记录 (旧记录)
    // 统一：next 为较老的记录  prev 为较新的记录
    // FIXME may cause bug
    const next = await this.noteModel
      .findOne({
        created: {
          $lt: latest.created,
        },
      })
      .sort({
        created: -1,
      })
      .select('nid _id')
      .lean()

    return {
      latest,
      next,
    }
  }

  checkPasswordToAccess<T extends NoteModel>(
    doc: T,
    password?: string,
  ): boolean {
    if (!doc.password) {
      return true
    }
    if (!password) {
      return false
    }
    return Object.is(password, doc.password)
  }

  public async create(document: NoteModel & { draftId?: string }) {
    this.lexicalService.populateText(document)

    const { draftId } = document
    const normalizedSlug = this.normalizeSlug(document.slug)

    await this.ensureSlugAvailable(normalizedSlug)

    if (normalizedSlug) {
      document.slug = normalizedSlug
    }

    document.created = getLessThanNow(document.created)
    if (document.meta) {
      document.meta = dbTransforms.json(document.meta) as any
    }

    const note = await this.noteModel.create(document)

    // 处理草稿：标记为已发布，并关联到新创建的日记
    if (draftId) {
      // Release draft's file references first, they will be re-associated to the note
      await this.fileReferenceService.removeReferencesForDocument(
        draftId,
        FileReferenceType.Draft,
      )
      await this.draftService.linkToPublished(draftId, note.id)
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      // Track file references
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
          {
            scope: EventScope.TO_SYSTEM_VISITOR,
          },
        ),
        !normalizedSlug &&
          this.aiSlugBackfillService
            .createBackfillTaskForNotes([note.id])
            .catch(() => undefined),
        !isLexical(note) &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            note.text,
            note.images,
            (images) => {
              note.images = images
              return note.save()
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

    const oldDoc = await this.noteModel.findById(id).lean()

    if (!oldDoc) {
      throw new NoContentCanBeModifiedException()
    }

    const { draftId } = data
    const hasSlugInput = Object.prototype.hasOwnProperty.call(data, 'slug')
    const normalizedSlug = hasSlugInput
      ? this.normalizeSlug(data.slug ?? undefined)
      : undefined

    if (hasSlugInput && normalizedSlug && normalizedSlug !== oldDoc.slug) {
      await this.ensureSlugAvailable(normalizedSlug, id)
    }

    const hasFieldChanged = (
      [
        'title',
        'text',
        'mood',
        'weather',
        'meta',
        'topicId',
        'slug',
      ] as (keyof NoteModel)[]
    ).some((key) => {
      if (key === 'slug' && hasSlugInput) {
        return normalizedSlug !== oldDoc.slug
      }
      return isDefined(data[key]) && data[key] !== oldDoc[key]
    })

    const hasContentChanged = ['title', 'text'].some((key) =>
      isDefined(data[key as keyof NoteModel]),
    )

    const updatedData = Object.assign(
      {},
      omit(data, NoteModel.protectedKeys.concat('slug' as any)),
      data.created
        ? {
            created: getLessThanNow(data.created),
          }
        : {},
      hasFieldChanged
        ? {
            updated: new Date(),
          }
        : {},
      hasContentChanged
        ? {
            modified: new Date(),
          }
        : {},
      data.meta !== undefined
        ? {
            meta: dbTransforms.json(data.meta),
          }
        : {},
      hasSlugInput && normalizedSlug
        ? {
            slug: normalizedSlug,
          }
        : {},
    )

    const updated = await this.noteModel
      .findOneAndUpdate(
        {
          _id: id,
        },
        updatedData,
        { new: true, timestamps: false },
      )
      .lean({
        getters: true,
        autopopulate: true,
      })

    if (!updated) {
      throw new NoContentCanBeModifiedException()
    }

    await this.trackSeoPathChanges(
      oldDoc as NoteModel,
      {
        created: (updatedData.created as Date | undefined) ?? oldDoc.created,
        slug: hasSlugInput ? normalizedSlug : oldDoc.slug,
      } as Pick<NoteModel, 'created' | 'slug'>,
      id,
    )

    // 处理草稿：标记为已发布
    if (draftId) {
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      // Update file references
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
            (images) => {
              return this.model
                .updateOne(
                  {
                    _id: id,
                  },
                  {
                    $set: {
                      images,
                    },
                  },
                )
                .exec()
            },
          ),
      ])
    })

    await this.broadcastNoteUpdateEvent(updated)

    return updated
  }

  private broadcastNoteUpdateEvent = debounce(
    async (updated: NoteModel) => {
      if (!updated) {
        return
      }
      this.eventManager.emit(
        BusinessEvents.NOTE_UPDATE,
        { id: updated.id },
        {
          scope: EventScope.TO_SYSTEM_VISITOR,
        },
      )
    },
    1000,
    { leading: false },
  )

  async deleteById(id: string) {
    const doc = await this.noteModel.findById(id)
    if (!doc) {
      return
    }

    await Promise.all([
      this.noteModel.deleteOne({
        _id: id,
      }),
      this.commentService.model.deleteMany({
        ref: id,
        refType: CollectionRefTypes.Note,
      }),
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
          {
            scope: EventScope.TO_SYSTEM_VISITOR,
          },
        ),
      ])
    })
  }

  async getIdByNid(nid: number) {
    const document = await this.model
      .findOne({
        nid,
      })
      .lean()
    if (!document) {
      return null
    }
    return document._id
  }

  async findOneByIdOrNid(unique: any) {
    if (!isMongoId(unique)) {
      const id = await this.getIdByNid(unique)
      return this.model.findOne({ _id: id })
    }

    return this.model.findById(unique)
  }

  async getNotePaginationByTopicId(
    topicId: string,
    pagination: PaginateOptions = {},
    condition?: QueryFilter<NoteModel>,
  ) {
    const { page = 1, limit = 10, ...rest } = pagination

    return await this.model.paginate(
      {
        topicId,
        ...condition,
      },
      {
        page,
        limit,
        ...rest,
      },
    )
  }
}
