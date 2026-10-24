import { z } from 'zod'

export const LobeHubFlowIdSchema = z.uuid()
export const LobeHubViews = {
  login: z.object({
    flowId: z.uuid(),
    userCode: z.string(),
    verificationUri: z.url(),
    verificationUriComplete: z.url().optional(),
    expiresAt: z.string(),
    intervalSeconds: z.number(),
  }),
  poll: z.discriminatedUnion('status', [
    z.object({ status: z.literal('pending'), intervalSeconds: z.number() }),
    z.object({ status: z.literal('connected') }),
    z.object({ status: z.literal('expired') }),
    z.object({ status: z.literal('denied') }),
  ]),
  account: z.object({
    status: z.enum(['connected', 'disconnected', 'refresh_required']),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
}

export const LobeHubCredentialSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().finite(),
})
export const LobeHubPendingSchema = z.object({
  deviceCode: z.string(),
  expiresAt: z.number(),
  intervalSeconds: z.number(),
  nextPollAt: z.number(),
})
