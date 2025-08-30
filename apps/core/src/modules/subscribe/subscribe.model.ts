import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: 'Subscribe',
  },
  schemaOptions: {
    timestamps: {
      updatedAt: false,
    },
  },
})
export class SubscribeModel extends BaseModel {
  @prop({
    required: true,
  })
  email: string

  @prop({
    required: true,
  })
  cancelToken: string

  @prop({
    required: true,
  })
  subscribe: number

  @prop({
    default: false,
  })
  verified: boolean
}
