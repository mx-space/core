import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { SyncableCollectionName } from '../sync/sync.constant'
import type { SyncableDataInteraction } from './sync-update.type'

import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { BusinessEvents } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'

import { SyncableCollectionNames } from '../sync/sync.constant'
import { SyncUpdateModel } from './sync-update.model'

@Injectable()
export class SyncUpdateService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel(SyncUpdateModel)
    private readonly syncUpdateModel: ReturnModelType<typeof SyncUpdateModel>,

    private readonly eventManager: EventManagerService,
  ) {}

  private eventDispose: () => void
  onModuleInit() {
    this.eventDispose = this.registerEvents()
  }

  registerEvents() {
    const disposers = SyncableCollectionNames.map(
      (eventType: SyncableCollectionName) => {
        const upperEventType = eventType.toUpperCase()
        return [
          this.eventManager.on(
            BusinessEvents[`${upperEventType}_CREATE`],
            (doc) => {
              this.recordUpdate(doc._id, eventType, 'create')
            },
          ),
          this.eventManager.on(
            BusinessEvents[`${upperEventType}_UPDATE`],
            (doc) => {
              this.recordUpdate(doc._id, eventType, 'update')
            },
          ),
          this.eventManager.on(
            BusinessEvents[`${upperEventType}_DELETE`],
            (id) => {
              this.recordUpdate(id, eventType, 'delete')
            },
          ),
        ]
      },
    )

    return () => {
      disposers.forEach((disposer) => disposer.forEach((d) => d()))
    }
  }
  onModuleDestroy() {
    this.eventDispose?.()
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
}
