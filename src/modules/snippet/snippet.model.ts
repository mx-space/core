import { index, modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

export enum SnippetType {
  'config:json' = 'json',
  'config:yml' = 'yml',
  'function' = 'function',
}

@modelOptions({
  options: {
    customName: 'snippet',
  },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
@index({ name: 1 })
@index({ type: 1 })
export class SnippetModel extends BaseModel {
  @prop({ type: SnippetType, default: SnippetType['config:json'] })
  type: SnippetModel

  @prop({ default: false })
  private: boolean

  @prop({ require: true })
  raw: string

  @prop({ require: true, unique: true })
  name: string
}
