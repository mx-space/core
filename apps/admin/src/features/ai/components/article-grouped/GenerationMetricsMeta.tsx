import type { GenerationMetrics } from '~/api/ai'
import { useI18n } from '~/i18n'

function formatUsd(value: number) {
  return `$${value.toFixed(4)} USD`
}

function formatUsdPrecise(value: number) {
  return `${value.toFixed(6)} USD`
}

function formatTokens(value: number) {
  return value.toLocaleString()
}

export function GenerationMetricsMeta(props: {
  metrics?: GenerationMetrics | null
}) {
  const { t } = useI18n()
  const metrics = props.metrics
  if (!metrics) return null

  const rows: Array<{ label: string; value: string; title?: string }> = []

  if (metrics.inputTokens != null) {
    rows.push({
      label: t('ai.metrics.inputTokens'),
      value: formatTokens(metrics.inputTokens),
    })
  }
  if (metrics.outputTokens != null) {
    rows.push({
      label: t('ai.metrics.outputTokens'),
      value: formatTokens(metrics.outputTokens),
    })
  }
  if (metrics.cacheReadTokens != null) {
    rows.push({
      label: t('ai.metrics.cacheReadTokens'),
      value: formatTokens(metrics.cacheReadTokens),
    })
  }
  if (metrics.cacheWriteTokens != null) {
    rows.push({
      label: t('ai.metrics.cacheWriteTokens'),
      value: formatTokens(metrics.cacheWriteTokens),
    })
  }
  if (metrics.totalTokens != null) {
    rows.push({
      label: t('ai.metrics.totalTokens'),
      value: formatTokens(metrics.totalTokens),
    })
  }
  if (metrics.costTotalUsd != null && metrics.costTotalUsd > 0) {
    const parts = [
      metrics.costInputUsd != null
        ? `${t('ai.metrics.costInput')}: ${formatUsdPrecise(metrics.costInputUsd)}`
        : null,
      metrics.costOutputUsd != null
        ? `${t('ai.metrics.costOutput')}: ${formatUsdPrecise(metrics.costOutputUsd)}`
        : null,
      metrics.costCacheReadUsd != null
        ? `${t('ai.metrics.costCacheRead')}: ${formatUsdPrecise(metrics.costCacheReadUsd)}`
        : null,
      metrics.costCacheWriteUsd != null
        ? `${t('ai.metrics.costCacheWrite')}: ${formatUsdPrecise(metrics.costCacheWriteUsd)}`
        : null,
    ].filter(Boolean)
    rows.push({
      label: t('ai.metrics.costTotal'),
      value: formatUsd(metrics.costTotalUsd),
      title: parts.length
        ? parts.join(' · ')
        : formatUsdPrecise(metrics.costTotalUsd),
    })
  }

  if (!rows.length) return null

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-fg">
        {t('ai.metrics.sectionTitle')}
      </p>
      <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
        {rows.map((row) => (
          <div className="contents" key={row.label}>
            <dt className="text-fg-muted">{row.label}</dt>
            <dd className="tabular-nums text-fg" title={row.title}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
