import { z } from 'zod'

import { zCoerceBoolean, zEntityId, zNonEmptyString } from '~/common/zod'

import { MetaFieldType, MetaPresetScope } from './meta-preset.enum'

const MetaFieldOptionSchema = z.object({
  value: z.any(),
  label: zNonEmptyString,
  exclusive: z.boolean().optional(),
})

const MetaPresetChildSchema = z.object({
  key: zNonEmptyString,
  label: zNonEmptyString,
  type: z.enum(MetaFieldType),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(MetaFieldOptionSchema).optional(),
})

export const CreateMetaPresetSchema = z.object({
  key: zNonEmptyString,
  label: zNonEmptyString,
  type: z.enum(MetaFieldType),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  scope: z.enum(MetaPresetScope).optional(),
  options: z.array(MetaFieldOptionSchema).optional(),
  allowCustomOption: z.boolean().optional(),
  children: z.array(MetaPresetChildSchema).optional(),
  order: z.number().optional(),
  enabled: z.boolean().optional(),
})

export type CreateMetaPresetDto = z.infer<typeof CreateMetaPresetSchema>

export const UpdateMetaPresetSchema = CreateMetaPresetSchema.partial()

export type UpdateMetaPresetDto = z.infer<typeof UpdateMetaPresetSchema>

export const QueryMetaPresetSchema = z.object({
  scope: z.enum(MetaPresetScope).optional(),
  enabledOnly: zCoerceBoolean.optional(),
})

export type QueryMetaPresetDto = z.infer<typeof QueryMetaPresetSchema>

export const UpdateOrderSchema = z.object({
  ids: z.array(zEntityId),
})

export type UpdateOrderDto = z.infer<typeof UpdateOrderSchema>

export type CreateMetaPresetInput = z.infer<typeof CreateMetaPresetSchema>
export type UpdateMetaPresetInput = z.infer<typeof UpdateMetaPresetSchema>
export type QueryMetaPresetInput = z.infer<typeof QueryMetaPresetSchema>
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>
