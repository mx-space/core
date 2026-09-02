import { z } from 'zod'

const validKeyPaths = [
  'category.name',
  'topic.name',
  'topic.introduce',
  'topic.description',
  'note.mood',
  'note.weather',
  'post.tag',
] as const

export const GenerateEntriesSchema = z
  .object({
    keyPaths: z.array(z.enum(validKeyPaths)).optional(),
    targetLangs: z.array(z.string()).optional(),
  })
  .default({})

export type GenerateEntriesDto = z.infer<typeof GenerateEntriesSchema>

export const QueryEntriesSchema = z.object({
  keyPath: z.enum(validKeyPaths).optional(),
  lang: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
})

export type QueryEntriesDto = z.infer<typeof QueryEntriesSchema>

export const UpdateEntrySchema = z.object({
  translatedText: z.string().min(1),
})

export type UpdateEntryDto = z.infer<typeof UpdateEntrySchema>
