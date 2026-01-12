import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: { customName: 'Say' },
})
export class SayModel extends BaseModel {
  @prop({ required: true })
  text: string

  @prop()
  source: string

  @prop()
  author: string
}
