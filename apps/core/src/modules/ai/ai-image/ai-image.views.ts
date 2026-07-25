import { z } from 'zod'

const DraftPromptRecipeSchema = z.object({
  format: z.string(),
  polarity: z.string(),
  family: z.string(),
  transformation: z.string(),
  geometry: z.string(),
  scaffold: z.string(),
  anchor: z.string(),
  accent: z.string(),
  text: z.string(),
})

const DraftPromptSchema = z.object({
  prompt: z.string(),
  recipe: DraftPromptRecipeSchema,
})

const GenerateImageResultSchema = z.object({
  taskId: z.string(),
  created: z.boolean(),
})

const PresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  defaultAspectRatio: z.string(),
})

const ImageModelSchema = z.object({
  id: z.string(),
  provider: z.string(),
})

export const AiImageViews = {
  draftPrompt: DraftPromptSchema,
  generate: GenerateImageResultSchema,
  preset: PresetSchema,
  model: ImageModelSchema,
} as const

export type DraftPromptView = z.infer<typeof DraftPromptSchema>
export type GenerateImageView = z.infer<typeof GenerateImageResultSchema>
export type PresetView = z.infer<typeof PresetSchema>
export type ImageModelView = z.infer<typeof ImageModelSchema>
