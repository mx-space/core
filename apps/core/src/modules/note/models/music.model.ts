import { IsNotEmpty, IsString } from 'class-validator'

import { modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({
  schemaOptions: {
    id: false,
    _id: false,
  },
})
export class NoteMusic {
  @IsString()
  @IsNotEmpty()
  @prop({ required: true })
  type: string

  @IsString()
  @IsNotEmpty()
  @prop({ required: true })
  id: string
}
