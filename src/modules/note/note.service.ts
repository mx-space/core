import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DocumentType } from '@typegoose/typegoose'
import { isDefined, isMongoId } from 'class-validator'
import { FilterQuery } from 'mongoose'
import { NoteModel } from './note.model'
import { InjectModel } from '~/transformers/model.transformer'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { EventBusEvents } from '~/constants/event.constant'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { ImageService } from '~/processors/helper/helper.image.service'
import { deleteKeys } from '~/utils'

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    private readonly imageService: ImageService,
    private readonly webGateway: WebEventsGateway,
    private readonly eventEmitter: EventEmitter2,
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
    password: string,
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
    const doc = await this.noteModel.create(document)
    process.nextTick(async () => {
      this.eventEmitter.emit(EventBusEvents.CleanAggregateCache)
      await Promise.all([
        this.imageService.recordImageDimensions(this.noteModel, doc._id),
        doc.hide || doc.password
          ? null
          : this.webGateway.broadcast(EventTypes.NOTE_CREATE, doc.toJSON()),
      ])
    })

    return doc
  }

  public async updateById(id: string, doc: Partial<NoteModel>) {
    deleteKeys(doc, ...NoteModel.protectedKeys)
    if (['title', 'text'].some((key) => isDefined(doc[key]))) {
      doc.modified = new Date()
    }

    const updated = await this.noteModel.findOneAndUpdate(
      {
        _id: id,
      },
      { ...doc },
      { new: true },
    )
    process.nextTick(async () => {
      this.eventEmitter.emit(EventBusEvents.CleanAggregateCache)
      await Promise.all([
        this.imageService.recordImageDimensions(this.noteModel, id),
        this.model.findById(id).then((doc) => {
          delete doc.password
          this.webGateway.broadcast(EventTypes.NOTE_UPDATE, doc)
        }),
      ])
    })
    return updated
  }

  async deleteById(id: string) {
    const doc = await this.noteModel.findById(id)
    if (!doc) {
      throw new CannotFindException()
    }

    await this.noteModel.deleteOne({
      _id: id,
    })

    process.nextTick(async () => {
      await Promise.all([this.webGateway.broadcast(EventTypes.NOTE_DELETE, id)])
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
