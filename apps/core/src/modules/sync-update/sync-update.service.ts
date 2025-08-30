import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ReturnModelType } from '@typegoose/typegoose'
import { BusinessEvents } from '~/constants/business-event.constant'
import {
  CATEGORY_COLLECTION_NAME,
  CHECKSUM_COLLECTION_NAME,
  NOTE_COLLECTION_NAME,
  PAGE_COLLECTION_NAME,
  POST_COLLECTION_NAME,
  TOPIC_COLLECTION_NAME,
} from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { md5 } from '~/utils/tool.util'
import type { SyncableCollectionName } from '../sync/sync.constant'
import { SyncableCollectionNames } from '../sync/sync.constant'
import { SyncUpdateModel } from './sync-update.model'
import type { SyncableDataInteraction } from './sync-update.type'

@Injectable()
export class SyncUpdateService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel(SyncUpdateModel)
    private readonly syncUpdateModel: ReturnModelType<typeof SyncUpdateModel>,

    private readonly eventManager: EventManagerService,
    private readonly databaseService: DatabaseService,
  ) {}

  private eventDispose: () => void
  onModuleInit() {
    this.eventDispose = this.registerEvents()
  }

  registerEvents() {
    const eventTypes = ['CREATE', 'UPDATE', 'DELETE']

    const disposers = SyncableCollectionNames.flatMap((collectionName) => {
      return eventTypes.map((type) => {
        const eventName =
          BusinessEvents[`${collectionName.toUpperCase()}_${type}`]
        const handler = (data: any) => {
          const isDelete = type === 'DELETE'
          const id = isDelete ? data.data : data._id

          this.recordUpdate(
            id,
            collectionName as SyncableCollectionName,
            type.toLowerCase() as SyncableDataInteraction,
          )

          if (isDelete) {
            this.deleteCheckSum(id)
          } else {
            this.updateCheckSum(id, data)
          }
        }
        return this.eventManager.on(eventName, handler)
      })
    })

    return () => disposers.forEach((disposer) => disposer())
  }
  onModuleDestroy() {
    this.eventDispose?.()
  }

  updateCheckSum(refId: string, data: any) {
    return this.databaseService.db
      .collection(CHECKSUM_COLLECTION_NAME)
      .updateOne(
        {
          refId,
        },
        {
          $set: {
            checksum: md5(JSON.stringify(data)),
          },
        },
        {
          upsert: true,
        },
      )
  }
  deleteCheckSum(refId: string) {
    return this.databaseService.db
      .collection(CHECKSUM_COLLECTION_NAME)
      .deleteOne({ refId })
  }
  recordUpdate(
    updateId: string,
    type: SyncableCollectionName,
    interection: SyncableDataInteraction,
  ) {
    return this.syncUpdateModel.create({
      updateId,
      type,
      updateAt: new Date(),
      interection,
    })
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncAllChecksum() {
    const db = this.databaseService.db
    const insertedChecksumRecords = [] as { refId: string; checksum: string }[]
    await Promise.all(
      [
        CATEGORY_COLLECTION_NAME,
        NOTE_COLLECTION_NAME,
        PAGE_COLLECTION_NAME,
        POST_COLLECTION_NAME,
        TOPIC_COLLECTION_NAME,
      ].map(async (collectionName) => {
        for await (const cur of db.collection(collectionName).find()) {
          insertedChecksumRecords.push({
            refId: cur._id.toHexString(),
            checksum: md5(JSON.stringify(cur)),
          })
        }
      }),
    )

    if (insertedChecksumRecords.length === 0) {
      return
    }

    const session = this.databaseService.client.startSession()
    session.startTransaction()

    try {
      await db.collection(CHECKSUM_COLLECTION_NAME).deleteMany({}, { session })
      await db
        .collection(CHECKSUM_COLLECTION_NAME)
        .insertMany(insertedChecksumRecords, { session })
      await session.commitTransaction()
    } catch {
      await session.abortTransaction()
    } finally {
      await session.endSession()
    }
  }
}
