import { Readable } from 'node:stream'
import { Inject, Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import {
  CATEGORY_COLLECTION_NAME,
  CHECKSUM_COLLECTION_NAME,
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  TOPIC_COLLECTION_NAME,
} from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { InjectModel } from '~/transformers/model.transformer'
import { md5 } from '~/utils/tool.util'
import type { Collection, Document, OptionalId } from 'mongodb'
import { Types } from 'mongoose'
import { CategoryService } from '../category/category.service'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'
import { SyncUpdateModel } from '../sync-update/sync-update.model'
import type { SyncableDataInteraction } from '../sync-update/sync-update.type'
import { TopicService } from '../topic/topic.service'
import type { SyncableCollectionName } from './sync.constant'
import { SyncableCollectionNames } from './sync.constant'

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

  @Inject()
  private readonly databaseService: DatabaseService

  private getCollections(): Record<
    SyncableCollectionName,
    Collection<OptionalId<Document>>
  > {
    const db = this.databaseService.db
    return {
      post: db.collection(POST_COLLECTION_NAME),
      page: db.collection(PAGE_COLLECTION_NAME),
      note: db.collection(NOTE_COLLECTION_NAME),
      category: db.collection(CATEGORY_COLLECTION_NAME),
      topic: db.collection(TOPIC_COLLECTION_NAME),
    }
  }

  buildSyncableData() {
    const readable = new Readable({
      read() {},
    })

    const collections = this.getCollections()
    const db = this.databaseService.db
    setImmediate(async () => {
      const tasks = SyncableCollectionNames.map(async (type) => {
        const queryCondition =
          type === 'note'
            ? (this.noteService as NoteService).publicNoteQueryCondition
            : {}
        const docs = await collections[type as SyncableCollectionName]

          .find(queryCondition)
          .toArray()

        const allRefIds = docs.map((entity) => entity._id.toHexString())
        const checksumCollection = db.collection(CHECKSUM_COLLECTION_NAME)
        const refIdChecksums = (await checksumCollection
          .find({
            refId: {
              $in: allRefIds,
            },
          })
          .toArray()) as any as { refId: string; checksum: string }[]

        const refId2Checksum = refIdChecksums.reduce((acc, cur) => {
          acc[cur.refId] = cur.checksum
          return acc
        }, {})

        docs.forEach((doc) => {
          readable.push(
            this.stringifySyncableData(
              type as SyncableCollectionName,
              doc,

              refId2Checksum[doc._id.toHexString()] || md5(JSON.stringify(doc)),
            ),
          )
        })
      })

      await Promise.all(tasks)

      readable.push(null)
    })
    return readable
  }

  async findByIds(
    type: SyncableCollectionName,
    ids: string[],
  ): Promise<{ entity: any; checksum: string }[]> {
    const baseQueryCondition = {
      _id: {
        $in: ids.map((id) => new Types.ObjectId(id)),
      },
    }
    const db = this.databaseService.db

    const collection = this.getCollections()[type]
    if (!collection) return []

    // If the type is 'note', merge the publicNoteQueryCondition
    const queryCondition =
      type === 'note'
        ? {
            ...baseQueryCondition,
            ...this.noteService.publicNoteQueryCondition,
          }
        : baseQueryCondition

    const entities = await collection.find(queryCondition).toArray()

    const allRefIds = entities.map((entity) => entity._id.toHexString())
    const checksumCollection = db.collection(CHECKSUM_COLLECTION_NAME)
    const refIdChecksum = (await checksumCollection
      .find({
        refId: {
          $in: allRefIds,
        },
      })
      .toArray()) as any as { refId: string; checksum: string }[]

    return entities.map((entity) => {
      const checksum =
        refIdChecksum.find((item) => item.refId === entity._id.toHexString())
          ?.checksum || md5(JSON.stringify(entity))
      return {
        entity,
        checksum,
      }
    })
  }

  async getAndRefreshChecksum(type: SyncableCollectionName, refId: string) {
    const collection = this.getCollections()[type]

    const document = await collection.findOne({
      _id: new Types.ObjectId(refId),
    })

    if (!document) return null

    const checksum = md5(JSON.stringify(document))

    const db = this.databaseService.db
    await db.collection(CHECKSUM_COLLECTION_NAME).updateOne(
      {
        refId,
      },
      {
        $set: {
          checksum,
        },
      },
      {
        upsert: true,
      },
    )

    return checksum
  }

  stringifySyncableData(
    type: 'post' | 'page' | 'note' | 'category' | 'topic',
    data: any,
    checksum: string,
    transformer?: (doc: any) => any,
  ) {
    const obj = {
      data,
      type,

      checksum,
    }

    if (transformer) {
      return `${JSON.stringify(transformer(obj))}\n`
    }
    return `${JSON.stringify(obj)}\n`
  }

  async getSyncLastSyncedAt(lastSyncedAt: string) {
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
        const results = await this.findByIds(type, ids)
        for (const result of results) {
          readable.push(
            this.stringifySyncableData(
              type,
              result.entity,
              result.checksum,
              (doc: any) => {
                Object.assign(doc, {
                  interection: ids[doc._id?.toHexString() || doc._id || doc.id],
                })
                return doc
              },
            ),
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
