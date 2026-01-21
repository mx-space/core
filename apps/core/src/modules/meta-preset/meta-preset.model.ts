import { modelOptions, prop, Severity } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { Schema } from 'mongoose'

/**
 * 元数据字段类型枚举
 */
export enum MetaFieldType {
  Text = 'text',
  Textarea = 'textarea',
  Number = 'number',
  Url = 'url',
  Select = 'select',
  MultiSelect = 'multi-select',
  Checkbox = 'checkbox',
  Tags = 'tags',
  Boolean = 'boolean',
  Object = 'object',
}

/**
 * 适用范围枚举
 */
export enum MetaPresetScope {
  Post = 'post',
  Note = 'note',
  Both = 'both',
}

/**
 * 字段选项（嵌入式）
 */
@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class MetaFieldOption {
  @prop({ type: Schema.Types.Mixed, required: true })
  value!: any

  @prop({ required: true })
  label!: string

  @prop({ default: false })
  exclusive?: boolean
}

/**
 * 子字段定义（用于 object 类型）
 */
export class MetaPresetChild {
  @prop({ required: true })
  key!: string

  @prop({ required: true })
  label!: string

  @prop({ required: true, type: String, enum: MetaFieldType })
  type!: MetaFieldType

  @prop()
  description?: string

  @prop()
  placeholder?: string

  @prop({ type: () => [MetaFieldOption], default: [] })
  options?: MetaFieldOption[]
}

/**
 * 元数据预设字段模型
 */
@modelOptions({
  options: { allowMixed: Severity.ALLOW, customName: 'MetaPreset' },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
export class MetaPresetModel extends BaseModel {
  @prop({ required: true, unique: true })
  key!: string

  @prop({ required: true })
  label!: string

  @prop({ required: true, type: String, enum: MetaFieldType })
  type!: MetaFieldType

  @prop()
  description?: string

  @prop()
  placeholder?: string

  @prop({
    required: true,
    type: String,
    enum: MetaPresetScope,
    default: MetaPresetScope.Both,
  })
  scope!: MetaPresetScope

  @prop({ type: () => [MetaFieldOption], default: [] })
  options?: MetaFieldOption[]

  @prop({ default: false })
  allowCustomOption?: boolean

  @prop({ type: () => [MetaPresetChild], default: [] })
  children?: MetaPresetChild[]

  @prop({ default: false })
  isBuiltin!: boolean

  @prop({ default: 0 })
  order!: number

  @prop({ default: true })
  enabled!: boolean

  updated?: Date
}
