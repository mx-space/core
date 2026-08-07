import { z } from 'zod'

const UploadResultSchema = z.object({
  url: z.string(),
  name: z.string(),
})

export const FileViews = {
  uploadResult: UploadResultSchema,
} as const

export type FileView = keyof typeof FileViews
