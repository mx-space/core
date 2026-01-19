import { zMongoId } from '~/common/zod'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export enum AckEventType {
  READ = 'read',
}

/**
 * Ack schema for API validation
 */
export const AckSchema = z.object({
  type: z.enum(AckEventType),
  payload: z.any(),
})

export class AckDto extends createZodDto(AckSchema) {}

/**
 * Ack read payload schema
 */
export const AckReadPayloadSchema = z.object({
  type: z.enum(ArticleTypeEnum),
  id: zMongoId,
})

export class AckReadPayloadDto extends createZodDto(AckReadPayloadSchema) {}

// Type exports
export type AckInput = z.infer<typeof AckSchema>
export type AckReadPayloadInput = z.infer<typeof AckReadPayloadSchema>
