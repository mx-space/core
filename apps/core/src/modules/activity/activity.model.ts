import { modelOptions, prop } from '@typegoose/typegoose'
import { ACTIVITY_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { Activity } from './activity.constant'

@modelOptions({
  options: {
    customName: ACTIVITY_COLLECTION_NAME,
  },
  schemaOptions: {
    timestamps: {
      updatedAt: false,
      createdAt: 'created',
    },
  },
})
export class ActivityModel extends BaseModel {
  @prop({ type: Number, enum: Activity })
  type: Activity

  @prop({
    get(val) {
      return JSON.safeParse(val)
    },
    type: String,
  })
  payload: any
}
