import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { Activity } from './activity.constant'

@modelOptions({
  options: {
    customName: 'activities',
  },
  schemaOptions: {
    timestamps: {
      updatedAt: false,
      createdAt: 'created',
    },
  },
})
export class ActivityModel extends BaseModel {
  @prop()
  type: Activity

  @prop({
    get(val) {
      return JSON.safeParse(val)
    },
    set(val) {
      return JSON.stringify(val)
    },
    type: String,
  })
  payload: any
}
