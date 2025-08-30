import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: 'readers',
  },
})
export class ReaderModel extends BaseModel {
  @prop()
  email: string
  @prop()
  name: string

  @prop()
  handle: string
  @prop()
  image: string

  @prop()
  isOwner: boolean
}
