import {
  index,
  modelOptions,
  mongoose,
  prop,
  Severity,
} from '@typegoose/typegoose'
import { SERVERLESS_STORAGE_COLLECTION_NAME } from '~/constants/db.constant'

@modelOptions({
  schemaOptions: {},
  options: {
    customName: SERVERLESS_STORAGE_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ namespace: 1, key: 1 })
export class ServerlessStorageModel {
  @prop({ index: 1, required: true })
  namespace: string

  @prop({ required: true })
  key: string

  @prop({ type: mongoose.Schema.Types.Mixed, required: true })
  value: any

  get uniqueKey(): string {
    return `${this.namespace}/${this.key}`
  }
}
