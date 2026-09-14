import { z } from 'zod'

import { AppErrorCode, createAppException } from '~/common/errors'

export const DEFAULT_FREE_WINDOW_HOURS = 72

const StrictPostPaywallMetaSchema = z.object({
  previewBlocks: z.number().int().min(0).optional(),
  freeWindowHours: z
    .number()
    .int()
    .min(0)
    .max(24 * 365)
    .optional(),
  freeUntil: z.iso.datetime().optional(),
  purchaseEnabled: z.boolean().optional(),
})

export const PostPaywallMetaSchema = z.object({
  previewBlocks:
    StrictPostPaywallMetaSchema.shape.previewBlocks.catch(undefined),
  freeWindowHours:
    StrictPostPaywallMetaSchema.shape.freeWindowHours.catch(undefined),
  freeUntil: StrictPostPaywallMetaSchema.shape.freeUntil.catch(undefined),
  purchaseEnabled:
    StrictPostPaywallMetaSchema.shape.purchaseEnabled.catch(undefined),
})

export type PostPaywallMeta = z.infer<typeof PostPaywallMetaSchema>

export function assertPaywallMetaValid(meta: unknown): void {
  const paywall = (meta as { paywall?: unknown } | null | undefined)?.paywall
  if (paywall === undefined || paywall === null) return
  const parsed = StrictPostPaywallMetaSchema.safeParse(paywall)
  if (!parsed.success) {
    throw createAppException(AppErrorCode.VALIDATION_FAILED, {
      issues: parsed.error.issues,
    })
  }
}

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
