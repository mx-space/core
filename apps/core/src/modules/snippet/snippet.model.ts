import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { EncryptUtil } from '~/utils/encrypt.util'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { SnippetType } from './snippet.schema'

export { SnippetType }

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
@plugin(aggregatePaginate)
@index({ name: 1, reference: 1 })
@index({ type: 1 })
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

  // 适用于
  @prop({ default: 'root' })
  reference: string

  // 注释
  @prop({})
  comment?: string

  // 元数据类型（预留二级类型，暂时不用）
  @prop({ maxlength: 20 })
  metatype?: string

  @prop()
  schema?: string

  // for function start
  @prop()
  method?: string

  @prop({
    select: false,
    get(val) {
      return EncryptUtil.decrypt(val)
    },
    set(val) {
      return EncryptUtil.encrypt(val)
    },
  })
  // username=123&password=123
  secret?: string
  // for function end

  @prop()
  enable?: boolean

  updated?: string

  @prop({
    default: false,
  })
  builtIn?: boolean
}
