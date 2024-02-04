import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({
  schemaOptions: {
    timestamps: false,
  },
  options: {
    customName: 'slug_tracker',
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
