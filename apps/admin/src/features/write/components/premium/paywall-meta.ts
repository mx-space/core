export const DEFAULT_FREE_WINDOW_HOURS = 72
export const DEFAULT_PREVIEW_BLOCKS = 3

export interface PaywallMeta {
  freeUntil?: string
  freeWindowHours?: number
  previewBlocks?: number
  purchaseEnabled?: boolean
}

export interface PaywallFormValues {
  freeUntil: string
  freeWindowHours: number
  previewBlocks: number
  purchaseEnabled: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getPaywallMeta(meta: Record<string, unknown>): PaywallMeta {
  const paywall = isRecord(meta.paywall) ? meta.paywall : {}
  return {
    freeUntil:
      typeof paywall.freeUntil === 'string' ? paywall.freeUntil : undefined,
    freeWindowHours:
      typeof paywall.freeWindowHours === 'number'
        ? paywall.freeWindowHours
        : undefined,
    previewBlocks:
      typeof paywall.previewBlocks === 'number'
        ? paywall.previewBlocks
        : undefined,
    purchaseEnabled:
      typeof paywall.purchaseEnabled === 'boolean'
        ? paywall.purchaseEnabled
        : undefined,
  }
}

export function resolvePaywallMeta(
  meta: Record<string, unknown>,
  isPremium: boolean,
  values: PaywallFormValues,
): Record<string, unknown> {
  if (!isPremium) return meta
  const existing = isRecord(meta.paywall) ? meta.paywall : {}
  const freeUntil = values.freeUntil || existing.freeUntil
  return {
    ...meta,
    paywall: {
      ...existing,
      ...(freeUntil ? { freeUntil } : {}),
      freeWindowHours: values.freeWindowHours,
      previewBlocks: values.previewBlocks,
      purchaseEnabled: values.purchaseEnabled,
    },
  }
}

export function parseFreeWindowHours(value: string) {
  const parsed = Math.floor(Number(value))
  return value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_FREE_WINDOW_HOURS
}
