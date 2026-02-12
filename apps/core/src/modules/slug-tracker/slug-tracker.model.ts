import { modelOptions, prop } from '@typegoose/typegoose'
import { SLUG_TRACKER_COLLECTION_NAME } from '~/constants/db.constant'

@modelOptions({
  schemaOptions: {
    timestamps: false,
  },
  options: {
    customName: SLUG_TRACKER_COLLECTION_NAME,
  },
})
export class SlugTrackerModel {
  @prop({ required: true })
  slug: string

  @prop({ required: true })
  type: string

  @prop({ required: true })
  targetId: string
}
