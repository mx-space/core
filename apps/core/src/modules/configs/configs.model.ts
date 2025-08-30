import { modelOptions, prop, Severity } from '@typegoose/typegoose'
import { Schema } from 'mongoose'

@modelOptions({
  options: { allowMixed: Severity.ALLOW, customName: 'Option' },
  schemaOptions: {
    timestamps: {
      createdAt: false,
      updatedAt: false,
    },
  },
})
export class OptionModel {
  @prop({ unique: true, required: true })
  name: string

  @prop({ type: Schema.Types.Mixed })
  value: any
}
