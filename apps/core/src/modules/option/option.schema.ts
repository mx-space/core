import type { IConfig } from '~/modules/configs/configs.interface'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Config key schema
 */
export const ConfigKeySchema = z.object({
  key: z.string().min(1) as z.ZodType<keyof IConfig>,
})

export class ConfigKeyDto extends createZodDto(ConfigKeySchema) {}

/**
 * Email template type schema
 */
export const EmailTemplateTypeSchema = z.object({
  type: z.string(),
})

export class EmailTemplateTypeDto extends createZodDto(
  EmailTemplateTypeSchema,
) {}

/**
 * Email template body schema
 */
export const EmailTemplateBodySchema = z.object({
  source: z.string(),
})

export class EmailTemplateBodyDto extends createZodDto(
  EmailTemplateBodySchema,
) {}

// Type exports
export type ConfigKeyInput = z.infer<typeof ConfigKeySchema>
export type EmailTemplateTypeInput = z.infer<typeof EmailTemplateTypeSchema>
export type EmailTemplateBodyInput = z.infer<typeof EmailTemplateBodySchema>
