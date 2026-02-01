import { forwardRef, Inject, Injectable } from '@nestjs/common'
import type { DocumentType } from '@typegoose/typegoose'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { FileReferenceType } from '~/modules/file/file-reference.model'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'
import { dbTransforms } from '~/utils/db-transform.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getLessThanNow } from '~/utils/time.util'
import { isDefined, isMongoId } from '~/utils/validator.util'
import dayjs from 'dayjs'
import { debounce, omit } from 'es-toolkit/compat'
import type { PaginateOptions, QueryFilter } from 'mongoose'
import { getArticleIdFromRoomName } from '../activity/activity.util'
import { CommentService } from '../comment/comment.service'
import { DraftRefType } from '../draft/draft.model'
import { DraftService } from '../draft/draft.service'
import { NoteModel } from './note.model'

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    private readonly imageService: ImageService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly eventManager: EventManagerService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,

    private readonly textMacrosService: TextMacroService,
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
    const isSecret = dayjs(note.publicAt).isAfter(new Date())

    return isSecret
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

    latest.text = await this.textMacrosService.replaceTextMacro(
      latest.text,
      latest,
    )

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
    const hasPassword = doc.password
    if (!hasPassword) {
      return true
    }
    if (!password) {
      return false
    }
    const isValid = Object.is(password, doc.password)
    return isValid
  }

  public async create(document: NoteModel & { draftId?: string }) {
    const { draftId } = document
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
        note.text,
        note.id,
        FileReferenceType.Note,
      )

      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.emit(BusinessEvents.NOTE_CREATE, note.toJSON(), {
          scope: EventScope.TO_SYSTEM,
        }),
        this.imageService.saveImageDimensionsFromMarkdownText(
          note.text,
          note.images,
          (images) => {
            note.images = images
            return note.save()
          },
        ),
        note.isPublished === false ||
        note.password ||
        this.checkNoteIsSecret(note)
          ? null
          : this.eventManager.broadcast(
              BusinessEvents.NOTE_CREATE,
              {
                ...note.toJSON(),
                text: await this.textMacrosService.replaceTextMacro(
                  note.text,
                  note,
                ),
              },
              {
                scope: EventScope.TO_VISITOR,
                gateway: {
                  rooms: [getArticleIdFromRoomName(note.id)],
                },
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
    const oldDoc = await this.noteModel.findById(id).lean()

    if (!oldDoc) {
      throw new NoContentCanBeModifiedException()
    }

    const { draftId } = data

    const hasFieldChanged = (
      [
        'title',
        'text',
        'mood',
        'weather',
        'meta',
        'topicId',
      ] as (keyof NoteModel)[]
    ).some((key) => {
      return isDefined(data[key]) && data[key] !== oldDoc[key]
    })

    const hasContentChanged = ['title', 'text'].some((key) =>
      isDefined(data[key as keyof NoteModel]),
    )

    const updatedData = Object.assign(
      {},
      omit(data, NoteModel.protectedKeys),
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

    // 处理草稿：标记为已发布
    if (draftId) {
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      // Update file references
      await this.fileReferenceService.updateReferencesForDocument(
        updated.text,
        updated.id,
        FileReferenceType.Note,
      )

      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
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

    await this.boardcaseNoteUpdateEvent(updated)

    return updated
  }

  private boardcaseNoteUpdateEvent = debounce(
    async (updated: NoteModel) => {
      if (!updated) {
        return
      }
      this.eventManager.broadcast(BusinessEvents.NOTE_UPDATE, updated, {
        scope: EventScope.TO_SYSTEM,
      })

      if (
        updated.password ||
        updated.isPublished === false ||
        updated.publicAt
      ) {
        return
      }
      this.eventManager.broadcast(
        BusinessEvents.NOTE_UPDATE,
        {
          ...updated,
          text: await this.textMacrosService.replaceTextMacro(
            updated.text,
            updated,
          ),
        },
        {
          scope: EventScope.TO_VISITOR,
          // gateway: {
          //   rooms: [getArticleIdFromRoomName(updated.id)],
          // },
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
    ])
    scheduleManager.schedule(async () => {
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.broadcast(BusinessEvents.NOTE_DELETE, id, {
          scope: EventScope.TO_SYSTEM_VISITOR,
        }),
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
