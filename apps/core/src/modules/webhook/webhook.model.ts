import { modelOptions, plugin, prop } from '@typegoose/typegoose'
import { EventScope } from '~/constants/business-event.constant'
import { mongooseLeanId } from '~/shared/model/plugins/lean-id'

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
    },
  },
  options: {
    customName: 'webhooks',
  },
})
@plugin(mongooseLeanId)
export class WebhookModel {
  @prop({ required: true })
  payloadUrl: string

  @prop({ required: true, type: String })
  events: string[]

  @prop({ required: true })
  enabled: boolean

  id: string

  @prop({ required: true, select: false })
  secret: string

  @prop({ type: Number, enum: EventScope })
  scope: EventScope
}
