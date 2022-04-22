import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({
  schemaOptions: { id: false, _id: false },
  options: { customName: 'count' },
})
export class CountModel {
  @prop({ default: 0 })
  read?: number

  @prop({ default: 0 })
  like?: number
}
