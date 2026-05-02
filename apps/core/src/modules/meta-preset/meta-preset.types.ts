import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { MetaFieldType, MetaPresetScope } from './meta-preset.enum'

export interface MetaFieldOption {
  value: any
  label: string
  exclusive?: boolean
}

export interface MetaPresetChild {
  key: string
  label: string
  type: MetaFieldType
  description?: string
  placeholder?: string
  options?: MetaFieldOption[]
}

export interface MetaPresetModel extends BaseModel {
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
  updated?: Date
}
