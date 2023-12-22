import { IsEnum, IsString, IsUrl } from 'class-validator'

import { PartialType } from '@nestjs/mapped-types'
import { modelOptions, prop } from '@typegoose/typegoose'

import { BusinessEvents } from '~/constants/business-event.constant'

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
  @IsUrl({
    require_protocol: true,
  })
  payloadUrl: string

  @prop({ required: true, type: String })
  @IsEnum(BusinessEvents, { each: true })
  events: string[]

  @prop({ required: true })
  enabled: boolean

  id: string

  @prop({ required: true, select: false })
  @IsString()
  secret: string
}

export class WebhookDtoPartial extends PartialType(WebhookModel) {}
