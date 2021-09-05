import { Injectable } from '@nestjs/common'
import { DocumentType } from '@typegoose/typegoose'
import { compareSync } from 'bcrypt'
import { FilterQuery } from 'mongoose'
import { InjectModel } from 'nestjs-typegoose'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { ImageService } from '~/processors/helper/helper.image.service'
import { deleteKeys } from '~/utils/index.util'
import { NoteModel } from './note.model'

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    private readonly imageService: ImageService,
    private readonly webGateway: WebEventsGateway,
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
      .exec()

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

    return {
      latest,
      next,
    }
  }

  checkPasswordToAccess(
    doc: DocumentType<NoteModel>,
    password: string,
  ): boolean {
    const hasPassword = doc.password
    if (!hasPassword) {
      return true
    }
    if (!password) {
      return false
    }
    const isValid = compareSync(password, doc.password)
    return isValid
  }

  public async create(document: NoteModel) {
    const doc = await this.noteModel.create(document)
    process.nextTick(async () => {
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
    console.log(NoteModel.protectedKeys)

    deleteKeys(doc, NoteModel.protectedKeys as any)
    await this.noteModel.updateOne(
      {
        _id: id,
      },
      { ...doc, modified: new Date() },
    )
    process.nextTick(async () => {
      Promise.all([
        this.imageService.recordImageDimensions(this.noteModel, id),
        this.model.findById(id).then((doc) => {
          if (doc.hide || doc.password) {
            return this.webGateway.broadcast(EventTypes.NOTE_UPDATE, doc)
          }
        }),
      ])

      // TODO clean cache
      // refreshKeyedCache(this.cacheManager)
    })
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
