import { modelOptions, plugin, prop, Ref } from '@typegoose/typegoose'
import { WEBHOOK_EVENT_COLLECTION_NAME } from '~/constants/db.constant'
import { mongooseLeanId } from '~/shared/model/plugins/lean-id'
import Paginate from 'mongoose-paginate-v2'
import { WebhookModel } from './webhook.model'

type JSON = string

const JSONProps = {
  type: String,
  set(value) {
    if (typeof value === 'object' && value) {
      return JSON.stringify(value)
    }
    return value
  },
}
@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
      updatedAt: false,
    },
  },
  options: {
    customName: WEBHOOK_EVENT_COLLECTION_NAME,
  },
})
@plugin(Paginate)
@plugin(mongooseLeanId)
export class WebhookEventModel {
  @prop(JSONProps)
  headers: JSON

  @prop(JSONProps)
  payload: JSON

  @prop()
  event: string

  @prop({ type: String })
  response: JSON

  @prop()
  success: boolean

  @prop({
    ref: () => WebhookModel,
    required: true,
  })
  hookId: Ref<WebhookModel>

  @prop({
    default: 0,
  })
  status: number
}
