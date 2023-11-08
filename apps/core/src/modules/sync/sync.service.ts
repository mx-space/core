import { Readable } from 'stream'
import type { SyncableDataInteraction } from '../sync-update/sync-update.type'
import type { SyncableCollectionName } from './sync.constant'

import { Inject, Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { InjectModel } from '~/transformers/model.transformer'
import { md5 } from '~/utils'

import { CategoryService } from '../category/category.service'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'
import { SyncUpdateModel } from '../sync-update/sync-update.model'
import { TopicService } from '../topic/topic.service'

@Injectable()
export class SyncService {
  @Inject()
  private readonly postService: PostService
  @Inject()
  private readonly noteService: NoteService

  @Inject()
  private readonly pageService: PageService

  @Inject()
  private readonly categoryService: CategoryService
  @Inject()
  private readonly topicService: TopicService

  @InjectModel(SyncUpdateModel)
  private readonly syncUpdateModel: ReturnModelType<typeof SyncUpdateModel>

  buildSyncableData() {
    const readable = new Readable({
      read() {},
    })

    setImmediate(async () => {
      // 创建一个通用的函数来处理查询和数据处理逻辑
      const processModel = async (
        service: any,
        type: SyncableCollectionName,
      ) => {
        const queryCondition =
          type === 'note' ? service.publicNoteQueryCondition : {}
        const docs = await service.model.find(queryCondition).lean()
        docs.forEach((doc) => {
          readable.push(this.stringifySyncableData(type, doc))
        })
      }

      const tasks = [
        processModel(this.noteService, 'note'),
        processModel(this.postService, 'post'),
        processModel(this.categoryService, 'category'),
        processModel(this.topicService, 'topic'),
        processModel(this.pageService, 'page'),
      ]

      await Promise.all(tasks)

      readable.push(null)
    })
    return readable
  }

  private async findById(type: SyncableCollectionName, id: string) {
    switch (type) {
      case 'post':
        return this.postService.model.findById(id).lean()
      case 'page':
        return this.pageService.model.findById(id).lean()
      case 'note':
        return this.noteService.model
          .findOne({
            _id: id,
            ...this.noteService.publicNoteQueryCondition,
          })
          .lean()
      case 'category':
        return this.categoryService.model.findById(id).lean()
      case 'topic':
        return this.topicService.model.findById(id).lean()
      default:
        return null
    }
  }

  private async findByIds(type: SyncableCollectionName, ids: string[]) {
    switch (type) {
      case 'post':
        return this.postService.model
          .find({
            _id: {
              $in: ids,
            },
          })
          .lean()

      case 'page':
        return this.pageService.model
          .find({
            _id: {
              $in: ids,
            },
          })
          .lean()
      case 'note':
        return this.noteService.model
          .find({
            _id: {
              $in: ids,
            },
            ...this.noteService.publicNoteQueryCondition,
          })
          .lean()
      case 'category':
        return this.categoryService.model
          .find({
            _id: {
              $in: ids,
            },
          })
          .lean()
      case 'topic':
        return this.topicService.model
          .find({
            _id: {
              $in: ids,
            },
          })
          .lean()
      default:
        return []
    }
  }

  findPublicByIdWithCheckSum({
    type,
    id,
    transformer,
    transformerFinalJSON,
  }: {
    type: SyncableCollectionName
    id: string
    transformer?: (doc: any) => any
    transformerFinalJSON?: (doc: {
      data: any
      type: SyncableCollectionName
      checksum: string
    }) => any
  }) {
    return this.findById(type, id).then((doc) => {
      if (!doc) {
        return null
      }

      const nextDoc = transformer?.(doc) || doc

      return this.stringifySyncableData(type, nextDoc, transformerFinalJSON)
    })
  }

  private stringifySyncableData(
    type: 'post' | 'page' | 'note' | 'category' | 'topic',
    data: any,
    transformer?: (doc: any) => any,
  ) {
    const obj = {
      data,
      type,
      // TODO checksum computed move to when update or create document
      checksum: md5(JSON.stringify(data)),
    }

    if (transformer) {
      return `${JSON.stringify(transformer(obj))}\n`
    }
    return `${JSON.stringify(obj)}\n`
  }

  async getSyncLastSyncedAtCollection(lastSyncedAt: string) {
    const lastSyncedAtDate = new Date(lastSyncedAt)
    const syncUpdates = await this.syncUpdateModel
      .find({
        updateAt: {
          $gte: lastSyncedAtDate,
        },
      })
      .lean()

    const readable = new Readable({
      read() {},
    })
    setImmediate(async () => {
      // 将不同类型的 ID 记录合并为一个对象
      const idsByType = {
        note: {},
        topic: {},
        category: {},
        post: {},
        page: {},
      } as Record<
        SyncableCollectionName,
        Record<string, SyncableDataInteraction>
      >

      const deletedItems = [] as SyncUpdateModel[]

      for (const item of syncUpdates) {
        const { interection, type, updateId } = item
        if (interection === 'delete') {
          deletedItems.push(item)
          continue
        }

        if (idsByType[type]) {
          idsByType[type][updateId] = interection
        }
      }

      // 函数用于处理重复逻辑
      const processDocs = async (
        type: SyncableCollectionName,
        ids: string[],
      ) => {
        const docs = await this.findByIds(type, ids)
        for (const doc of docs) {
          readable.push(
            this.stringifySyncableData(type, doc, (doc: any) => {
              Object.assign(doc, {
                interection: ids[doc._id?.toHexString() || doc._id || doc.id],
              })
              return doc
            }),
          )
        }
      }

      const tasks = [] as Promise<any>[]

      for (const [type, record] of Object.entries(idsByType)) {
        tasks.push(
          processDocs(type as SyncableCollectionName, Object.keys(record)),
        )
      }

      await Promise.all(tasks)

      readable.push(
        JSON.stringify({
          deleted: deletedItems.map((item) => ({
            id: item.updateId,
            type: item.type,
          })),
        }),
      )
      readable.push(null)
    })

    return readable
  }
}

///  NOTE
///  现在 mongoose 查询方式不能保证结果的类型是同一个，在 Note RESTFul 查到的也可能和 Syncable data 不一致
///  导致现在不能直接通过 checksum 来判断数据变动
///  而且现在实时计算 checksum 也不是一个好的选择。
///  后续在考虑是否需要在创建和更新的时候计算 checksum，然后在查询的时候直接返回 checksum
///  checksum 可以根据一些关键的数据字段综合得出
