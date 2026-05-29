import type { TranslationKey } from '~/i18n/types'
import type { EnrichmentCaptureQuota } from '~/models/enrichment'
import type { EnrichmentSource } from '../types/enrichment'

type Translator = (key: TranslationKey) => string

export function isEnrichmentSource(value: unknown): value is EnrichmentSource {
  return value === 'cache' || value === 'probe' || value === 'screenshots'
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function getRecaptureDisabledReason(
  quota: EnrichmentCaptureQuota | null,
  t: Translator,
) {
  if (!quota) return t('enrichment.quota.loading')
  if (!quota.enabled) return t('enrichment.quota.disabled')
  if (quota.fetchMode !== 'browser')
    return t('enrichment.quota.modeUnsupported')
  return null
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
