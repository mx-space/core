import { modelOptions, prop } from '@typegoose/typegoose'
import { IsNumber } from 'class-validator'

@modelOptions({ schemaOptions: { id: false, _id: false } })
export class Coordinate {
  @IsNumber()
  @prop()
  latitude: number
  @prop()
  @IsNumber()
  longitude: number
}
