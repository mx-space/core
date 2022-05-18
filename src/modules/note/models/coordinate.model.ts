import { IsNumber } from 'class-validator'

import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({ schemaOptions: { id: false, _id: false } })
export class Coordinate {
  @IsNumber()
  @prop()
  latitude: number
  @prop()
  @IsNumber()
  longitude: number
}
