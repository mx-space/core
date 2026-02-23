import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'
import { SNIPPET_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { EncryptUtil } from '~/utils/encrypt.util'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { SnippetType } from './snippet.schema'

export { SnippetType }

@modelOptions({
  options: {
    customName: SNIPPET_COLLECTION_NAME,
  },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
@plugin(aggregatePaginate)
@index({ name: 1, reference: 1 })
@index({ type: 1 })
@index({ customPath: 1 }, { unique: true, sparse: true })
export class SnippetModel extends BaseModel {
  @prop({
    type: () => String,
    default: SnippetType.JSON,
    enum: Object.values(SnippetType),
  })
  type: SnippetType

  @prop({ default: false })
  private: boolean

  @prop({ require: true })
  raw: string

  @prop({ require: true, trim: true })
  name: string

  @prop({ default: 'root' })
  reference: string

  @prop({})
  comment?: string

  @prop({ maxlength: 20 })
  metatype?: string

  @prop()
  schema?: string

  @prop()
  method?: string

  @prop({ trim: true })
  customPath?: string

  @prop({
    select: false,
    get(val) {
      return EncryptUtil.decrypt(val)
    },
    set(val) {
      return EncryptUtil.encrypt(val)
    },
  })
  secret?: string

  @prop()
  enable?: boolean

  updated?: string

  @prop({
    default: false,
  })
  builtIn?: boolean

  @prop({ select: false })
  compiledCode?: string
}
