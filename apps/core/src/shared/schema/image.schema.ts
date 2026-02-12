import { zHexColor, zStrictUrl } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const ImageSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  accent: zHexColor.optional(),
  type: z.string().optional(),
  src: zStrictUrl.optional(),
  blurHash: z.string().optional(),
})

export class ImageDto extends createZodDto(ImageSchema) {}

export type ImageInput = z.infer<typeof ImageSchema>
