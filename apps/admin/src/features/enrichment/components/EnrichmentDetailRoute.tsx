import { useParams } from 'react-router'

import { useI18n } from '~/i18n'

import { CacheDetailPanel } from './CacheDetailPanel'
import { CaptureDetail } from './CaptureDetail'
import { useEnrichmentRouteContext } from './enrichment-route-context'
import { DetailEmpty } from './EnrichmentPrimitives'

export function EnrichmentDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const ctx = useEnrichmentRouteContext()

  if (!id) {
    return (
      <DetailEmpty
        label={
          ctx.source === 'screenshots'
            ? t('enrichment.detail.emptyCapture')
            : t('enrichment.detail.emptyCache')
        }
      />
    )
  }

  if (ctx.source === 'screenshots') {
    const row = ctx.captureRows.find((r) => r.enrichmentId === id) ?? null
    if (!row) return <DetailEmpty label={t('enrichment.detail.emptyCapture')} />
    return (
      <CaptureDetail
        invalidateAll={ctx.invalidateAll}
        onBack={ctx.onBack}
        onDeleted={ctx.onCaptureDeleted}
        quota={ctx.quota}
        row={row}
      />
    )
  }

  const fallback = ctx.cacheRows.find((r) => r.id === id) ?? null
  return (
    <CacheDetailPanel
      fallback={fallback}
      id={id}
      invalidateAll={ctx.invalidateAll}
      onBack={ctx.onBack}
      onJumpToScreenshot={ctx.onJumpToScreenshot}
    />
  )
}

export default EnrichmentDetailRoute
