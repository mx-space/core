import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({ schemaOptions: { id: false, _id: false } })
export class Coordinate {
  @prop()
  latitude: number

  @prop()
  longitude: number
}
