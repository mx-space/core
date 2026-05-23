import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zHexColor, zStrictUrl } from '~/common/zod'

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

/**
 * Image array schema that tolerates null/undefined by collapsing to [].
 * Use this everywhere a write payload accepts an `images` field.
 */
export const ImageArraySchema = z.preprocess(
  (val) => (val == null ? [] : val),
  z.array(ImageSchema),
)
