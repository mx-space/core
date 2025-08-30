import { PartialType } from '@nestjs/mapped-types'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'
import { EventScope } from '~/constants/business-event.constant'
import { mongooseLeanId } from '~/shared/model/plugins/lean-id'
import { IsBoolean, IsEnum, IsString, IsUrl } from 'class-validator'

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
  @IsUrl({
    require_protocol: true,
  })
  payloadUrl: string

  @prop({ required: true, type: String })
  @IsString({ each: true })
  events: string[]

  @prop({ required: true })
  @IsBoolean()
  enabled: boolean

  id: string

  @prop({ required: true, select: false })
  @IsString()
  secret: string

  @prop({ enum: EventScope })
  @IsEnum(EventScope)
  scope: EventScope
}

export class WebhookDtoPartial extends PartialType(WebhookModel) {}
