import { z } from 'zod'

import type { IConfig } from '~/modules/configs/configs.interface'

/**
 * Config key schema
 */
export const ConfigKeySchema = z.object({
  key: z.string().min(1) as z.ZodType<keyof IConfig>,
})

export type ConfigKeyDto = z.infer<typeof ConfigKeySchema>

/**
 * Email template type schema
 */
export const EmailTemplateTypeSchema = z.object({
  type: z.string(),
})

export type EmailTemplateTypeDto = z.infer<typeof EmailTemplateTypeSchema>

/**
 * Email template body schema
 */
export const EmailTemplateBodySchema = z.object({
  source: z.string(),
})

export type EmailTemplateBodyDto = z.infer<typeof EmailTemplateBodySchema>

// Type exports
export type ConfigKeyInput = z.infer<typeof ConfigKeySchema>
export type EmailTemplateTypeInput = z.infer<typeof EmailTemplateTypeSchema>
export type EmailTemplateBodyInput = z.infer<typeof EmailTemplateBodySchema>
