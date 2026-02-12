import {
  index,
  modelOptions,
  mongoose,
  prop,
  Severity,
} from '@typegoose/typegoose'
import { SERVERLESS_LOG_COLLECTION_NAME } from '~/constants/db.constant'

@modelOptions({
  options: {
    customName: SERVERLESS_LOG_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: false,
    },
    versionKey: false,
  },
})
@index({ created: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 })
@index({ created: -1 })
@index({ functionId: 1, created: -1 })
@index({ reference: 1, name: 1, created: -1 })
export class ServerlessLogModel {
  created?: Date

  id: string

  @prop({ required: true })
  functionId: string

  @prop({ required: true })
  reference: string

  @prop({ required: true })
  name: string

  @prop()
  method: string

  @prop()
  ip: string

  @prop({ required: true, enum: ['success', 'error'] })
  status: 'success' | 'error'

  @prop({ required: true })
  executionTime: number

  @prop({ type: () => [mongoose.Schema.Types.Mixed] })
  logs: { level: string; timestamp: number; args: unknown[] }[]

  @prop({ type: mongoose.Schema.Types.Mixed })
  error?: { name: string; message: string; stack?: string }
}
