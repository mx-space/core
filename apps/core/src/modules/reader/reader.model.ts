import { modelOptions, prop } from '@typegoose/typegoose'
import { READER_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: READER_COLLECTION_NAME,
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
  role: 'reader' | 'owner'
}
