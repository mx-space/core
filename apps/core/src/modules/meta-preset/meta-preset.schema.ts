import { zCoerceBoolean, zMongoId, zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { MetaFieldType, MetaPresetScope } from './meta-preset.model'

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

export class CreateMetaPresetDto extends createZodDto(CreateMetaPresetSchema) {}

export const UpdateMetaPresetSchema = CreateMetaPresetSchema.partial()

export class UpdateMetaPresetDto extends createZodDto(UpdateMetaPresetSchema) {}

export const QueryMetaPresetSchema = z.object({
  scope: z.enum(MetaPresetScope).optional(),
  enabledOnly: zCoerceBoolean.optional(),
})

export class QueryMetaPresetDto extends createZodDto(QueryMetaPresetSchema) {}

export const UpdateOrderSchema = z.object({
  ids: z.array(zMongoId),
})

export class UpdateOrderDto extends createZodDto(UpdateOrderSchema) {}

export type CreateMetaPresetInput = z.infer<typeof CreateMetaPresetSchema>
export type UpdateMetaPresetInput = z.infer<typeof UpdateMetaPresetSchema>
export type QueryMetaPresetInput = z.infer<typeof QueryMetaPresetSchema>
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>
