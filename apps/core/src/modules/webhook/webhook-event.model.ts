import { modelOptions, prop, Ref } from '@typegoose/typegoose'

import { WEBHOOK_EVENT_COLLECTION_NAME } from '~/constants/db.constant'

import { WebhookModel } from './webhook.model'

type JSON = string
@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
    },
  },
  options: {
    customName: WEBHOOK_EVENT_COLLECTION_NAME,
  },
})
export class WebhookEventModel {
  @prop({
    type: String,
  })
  headers: JSON

  @prop({
    type: String,
  })
  payload: JSON

  @prop()
  event: string

  @prop({ type: String })
  response: JSON

  @prop()
  success: boolean

  @prop({
    ref: () => WebhookModel,
  })
  hookId: Ref<WebhookModel>

  @prop({
    default: 0,
  })
  status: number
}
