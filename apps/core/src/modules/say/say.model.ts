import { modelOptions, prop } from '@typegoose/typegoose'
import { SAY_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: { customName: SAY_COLLECTION_NAME },
})
export class SayModel extends BaseModel {
  @prop({ required: true })
  text: string

  @prop()
  source: string

  @prop()
  author: string
}
