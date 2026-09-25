import { z } from 'zod'

const ProjectCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    avatar: z.string().nullable(),
    previewUrl: z.string().nullable(),
    projectUrl: z.string().nullable(),
    createdAt: z.date().or(z.string()),
  })
  .loose()

const ProjectDetailSchema = z.object({}).loose()

export const ProjectViews = {
  card: ProjectCardSchema,
  detail: ProjectDetailSchema,
} as const

export type ProjectView = keyof typeof ProjectViews
