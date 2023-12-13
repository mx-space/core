import { modelOptions, prop } from '@typegoose/typegoose'

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
export class WebhookModel {
  @prop({ required: true })
  payloadUrl: string

  @prop({ required: true })
  events: string[]

  @prop({ required: true })
  enabled: boolean

  id: string

  @prop({ required: true, select: false })
  secret: string
}
