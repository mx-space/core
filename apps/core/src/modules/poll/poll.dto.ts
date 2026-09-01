import { z } from 'zod'

const PollIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^p_[\da-z]+$/i)

const OptionIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^o_[\da-z]+$/i)

export const PollIdParam = z.object({ pollId: PollIdSchema })
export type PollIdDto = z.infer<typeof PollIdParam>

export const SubmitPollSchema = z.object({
  optionIds: z.array(OptionIdSchema).min(1).max(20),
})
export type SubmitPollDto = z.infer<typeof SubmitPollSchema>

export const BatchPollQuerySchema = z.object({
  ids: z
    .string()
    .min(3)
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(PollIdSchema).min(1).max(50)),
})
export type BatchPollQueryDto = z.infer<typeof BatchPollQuerySchema>
