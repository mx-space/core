import { modelOptions, prop } from '@typegoose/typegoose'
import { SUBSCRIBE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: SUBSCRIBE_COLLECTION_NAME,
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
