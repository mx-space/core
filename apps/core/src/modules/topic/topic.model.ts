import { modelOptions, prop } from '@typegoose/typegoose'
import { TOPIC_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import slugify from 'slugify'

@modelOptions({
  options: {
    customName: TOPIC_COLLECTION_NAME,
  },
})
export class TopicModel extends BaseModel {
  @prop({ default: '' })
  description?: string

  @prop()
  introduce: string

  @prop({ unique: true, index: true })
  name: string

  @prop({
    unique: true,
    set(val) {
      return slugify(val)
    },
  })
  slug: string

  @prop()
  icon?: string
}
