import { modelOptions, prop } from '@typegoose/typegoose'
import { PAGE_COLLECTION_NAME } from '~/constants/db.constant'
import { WriteBaseModel } from '~/shared/model/write-base.model'

@modelOptions({
  options: {
    customName: PAGE_COLLECTION_NAME,
  },
})
export class PageModel extends WriteBaseModel {
  @prop({ trim: 1, index: true, required: true, unique: true })
  slug!: string

  @prop({ trim: true, type: String })
  subtitle?: string | null

  @prop({ default: 1 })
  order!: number
}
