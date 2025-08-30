import { modelOptions, prop } from '@typegoose/typegoose'
import {
  SyncableCollectionName,
  SyncableCollectionNames,
} from '../sync/sync.constant'
import {
  SyncableDataInteraction,
  SyncableDataInteractions,
} from './sync-update.type'

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: false,
      updatedAt: false,
    },
  },
  options: {
    customName: 'sync_update',
  },
})
export class SyncUpdateModel {
  @prop({
    required: true,
  })
  updateId: string

  @prop({
    required: true,
    index: true,
  })
  updateAt: Date

  @prop({
    enum: SyncableCollectionNames,
    required: true,
  })
  type: SyncableCollectionName

  @prop({
    enum: SyncableDataInteractions,
    required: true,
  })
  interection: SyncableDataInteraction
}
