import { z } from 'zod'

export const GeneralSettingSchema = z.object({
  fontSize: z.number().int().default(14),
  fontFamily: z
    .string()
    .default(
      '"Helvetica Neue","Luxi Sans","DejaVu Sans","Hiragino Sans GB","Microsoft Yahei",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol","Android Emoji","EmojiSymbols"',
    ),

  renderMode: z.enum(['plain', 'wysiwyg']).default('plain'),
})

export type GeneralSettingDto = z.infer<typeof GeneralSettingSchema>
