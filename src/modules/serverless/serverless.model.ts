import {
  Severity,
  index,
  modelOptions,
  mongoose,
  prop,
} from '@typegoose/typegoose'

export const ServerlessStorageCollectionName = `serverlessstorages`

@modelOptions({
  schemaOptions: {},
  options: {
    customName: ServerlessStorageCollectionName,
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
