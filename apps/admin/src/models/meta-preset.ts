/**
 * 元数据字段类型
 */
export type MetaFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'url'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'tags'
  | 'boolean'
  | 'object'

/**
 * 适用范围
 */
export type MetaPresetScope = 'post' | 'note' | 'both'

/**
 * 字段选项
 */
export interface MetaFieldOption {
  value: any
  label: string
  exclusive?: boolean
}

/**
 * 子字段定义（用于 object 类型）
 */
export interface MetaPresetChild {
  key: string
  label: string
  type: MetaFieldType
  description?: string
  placeholder?: string
  options?: MetaFieldOption[]
}

/**
 * 元数据预设字段
 */
export interface MetaPresetField {
  id: string
  key: string
  label: string
  type: MetaFieldType
  description?: string
  placeholder?: string
  scope: MetaPresetScope
  options?: MetaFieldOption[]
  allowCustomOption?: boolean
  children?: MetaPresetChild[]
  isBuiltin: boolean
  order: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * AI 生成类型值
 */
export type AiGenValue =
  | -1
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | (string & {})

/**
 * 创建预设字段请求
 */
export interface CreateMetaPresetDto {
  key: string
  label: string
  type: MetaFieldType
  description?: string
  placeholder?: string
  scope?: MetaPresetScope
  options?: MetaFieldOption[]
  allowCustomOption?: boolean
  children?: MetaPresetChild[]
  order?: number
  enabled?: boolean
}

/**
 * 更新预设字段请求
 */
export type UpdateMetaPresetDto = Partial<CreateMetaPresetDto>
