import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zAllowedUrl } from '~/common/zod'

const URL_NULLISH = zAllowedUrl.nullish()

export const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  previewUrl: URL_NULLISH,
  docUrl: URL_NULLISH,
  projectUrl: URL_NULLISH,
  avatar: URL_NULLISH,
  images: z.array(zAllowedUrl).max(20).nullish(),
  text: z.string().max(50_000).nullish(),
})

export const ProjectPatchSchema = ProjectCreateSchema.partial()

export class ProjectCreateDto extends createZodDto(ProjectCreateSchema) {}
export class ProjectPatchDto extends createZodDto(ProjectPatchSchema) {}

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>
export type ProjectPatchInput = z.infer<typeof ProjectPatchSchema>
