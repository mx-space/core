import { z } from 'zod'

export const DEFAULT_FREE_WINDOW_HOURS = 72

export const PostPaywallMetaSchema = z.object({
  previewBlocks: z.number().int().min(0).optional().catch(undefined),
  freeWindowHours: z
    .number()
    .int()
    .min(0)
    .max(24 * 365)
    .optional()
    .catch(undefined),
  freeUntil: z.iso.datetime().optional().catch(undefined),
  purchaseEnabled: z.boolean().optional().catch(undefined),
})

export type PostPaywallMeta = z.infer<typeof PostPaywallMetaSchema>

export function readPaywallMeta(meta: unknown): PostPaywallMeta {
  const paywall = (meta as { paywall?: unknown } | null | undefined)?.paywall
  const parsed = PostPaywallMetaSchema.safeParse(paywall)
  return parsed.success ? parsed.data : {}
}

export function isInFreeWindow(meta: unknown, now = new Date()): boolean {
  const { freeUntil } = readPaywallMeta(meta)
  return !!freeUntil && now.getTime() < Date.parse(freeUntil)
}

export function applyFreeWindowOnPublish(
  meta: unknown,
  now = new Date(),
): Record<string, unknown> {
  const base =
    meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
  const paywall = readPaywallMeta(base)
  if (paywall.freeUntil) return base
  const hours = paywall.freeWindowHours ?? DEFAULT_FREE_WINDOW_HOURS
  const freeUntil = new Date(now.getTime() + hours * 3_600_000).toISOString()
  const existing =
    base.paywall && typeof base.paywall === 'object'
      ? (base.paywall as Record<string, unknown>)
      : {}
  return { ...base, paywall: { ...existing, freeUntil } }
}
