import { forwardRef, Inject, Injectable } from '@nestjs/common'
import type { DocumentType } from '@typegoose/typegoose'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'
import { getLessThanNow } from '~/utils/time.util'
import { isDefined, isMongoId } from 'class-validator'
import dayjs from 'dayjs'
import { debounce, omit } from 'lodash'
import type { FilterQuery, PaginateOptions } from 'mongoose'
import { getArticleIdFromRoomName } from '../activity/activity.util'
import { CommentService } from '../comment/comment.service'
import { NoteModel } from './note.model'

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    private readonly imageService: ImageService,
    private readonly eventManager: EventManagerService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,

    private readonly textMacrosService: TextMacroService,
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
    condition: FilterQuery<DocumentType<NoteModel>> = {},
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

  public async create(document: NoteModel) {
    document.created = getLessThanNow(document.created)

    const note = await this.noteModel.create(document)
    scheduleManager.schedule(async () => {
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

  public async updateById(id: string, data: Partial<NoteModel>) {
    const updatedData = Object.assign(
      {},
      omit(data, NoteModel.protectedKeys),
      data.created
        ? {
            created: getLessThanNow(data.created),
          }
        : {},
    )

    if (['title', 'text'].some((key) => isDefined(data[key]))) {
      data.modified = new Date()
    }

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

    scheduleManager.schedule(async () => {
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

  /**
   * 查找 nid 时候正确，返回 _id
   *
   * @param {number} nid
   * @returns {Types.ObjectId}
   */
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
    condition?: FilterQuery<NoteModel>,
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
