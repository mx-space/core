import { Severity, modelOptions, prop } from '@typegoose/typegoose'
import { Schema } from 'mongoose'

@modelOptions({
  options: { allowMixed: Severity.ALLOW, customName: 'Option' },
  schemaOptions: {
    timestamps: {
      createdAt: null,
      updatedAt: null,
    },
  },
})
export class OptionModel {
  @prop({ unique: true, required: true })
  name: string

  @prop({ type: Schema.Types.Mixed })
  value: any
}
