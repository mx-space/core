import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({
  schemaOptions: { _id: false },
})
export abstract class ImageModel {
  @prop()
  width?: number

  @prop()
  height?: number

  @prop()
  accent?: string

  @prop()
  type?: string

  @prop()
  src?: string

  @prop()
  blurHash?: string
}
