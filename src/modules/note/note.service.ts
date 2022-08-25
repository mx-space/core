import { isDefined, isMongoId } from 'class-validator'
import { omit } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'

import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { DocumentType } from '@typegoose/typegoose'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getLessThanNow } from '~/utils'

import { CommentRefTypes } from '../comment/comment.model'
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
  ) {
    this.needCreateDefult()
  }

  public get model() {
    return this.noteModel
  }

  async getLatestOne(
    condition: FilterQuery<DocumentType<NoteModel>> = {},
    projection: any = undefined,
  ) {
    // TODO master
    const latest = await this.noteModel
      .findOne(condition, projection)
      .sort({
        created: -1,
      })
      .lean()

    if (!latest) {
      throw new CannotFindException()
    }

    latest.text = await this.textMacrosService.replaceTextMacro(
      latest.text,
      latest,
    )

    // 是否存在上一条记录 (旧记录)
    // 统一: next 为较老的记录  prev 为较新的记录
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

    const doc = await this.noteModel.create(document)
    process.nextTick(async () => {
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.emit(BusinessEvents.NOTE_CREATE, doc.toJSON(), {
          scope: EventScope.TO_SYSTEM,
        }),
        this.imageService.saveImageDimensionsFromMarkdownText(
          doc.text,
          doc.images,
          (images) => {
            doc.images = images
            return doc.save()
          },
        ),
        doc.hide || doc.password
          ? null
          : this.eventManager.broadcast(
              BusinessEvents.NOTE_CREATE,
              {
                ...doc.toJSON(),
                text: await this.textMacrosService.replaceTextMacro(
                  doc.text,
                  doc,
                ),
              },
              {
                scope: EventScope.TO_VISITOR,
              },
            ),
      ])
    })

    return doc
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
      })

    if (!updated) {
      throw new NoContentCanBeModifiedException()
    }

    process.nextTick(async () => {
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      })
      await Promise.all([
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
        this.model
          .findById(id)
          .lean()
          .then(async (doc) => {
            if (!doc) {
              return
            }
            delete doc.password
            this.eventManager.broadcast(BusinessEvents.NOTE_UPDATE, doc, {
              scope: EventScope.TO_SYSTEM,
            })

            this.eventManager.broadcast(
              BusinessEvents.NOTE_UPDATE,
              {
                ...doc,
                text: await this.textMacrosService.replaceTextMacro(
                  doc.text,
                  doc,
                ),
              },
              {
                scope: EventScope.TO_VISITOR,
              },
            )
          }),
      ])
    })
    return updated
  }

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
        refType: CommentRefTypes.Note,
      }),
    ])
    process.nextTick(async () => {
      await Promise.all([
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

  async needCreateDefult() {
    await this.noteModel.countDocuments({}).then((count) => {
      if (!count) {
        this.noteModel.countDocuments({
          title: '第一篇日记',
          text: 'Hello World',
        })
      }
    })
  }
}
