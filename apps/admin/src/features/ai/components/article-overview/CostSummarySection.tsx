import type { AiOverviewDetail } from '~/api/ai-overview'
import { AI_OVERVIEW_CAPABILITIES } from '~/api/ai-overview'
import { useI18n } from '~/i18n'

import { CAPABILITY_META } from './capability-meta'

function formatUsd(value: number) {
  return `$${value.toFixed(4)}`
}

function formatTokens(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

export function CostSummarySection(props: { cost: AiOverviewDetail['cost'] }) {
  const { t } = useI18n()
  const { total, byResourceType, models } = props.cost

  if (!total.generationCount) return null

  const breakdown = AI_OVERVIEW_CAPABILITIES.filter(
    (capability) => byResourceType[capability]?.generationCount,
  )

  return (
    <section className="rounded-md border border-border p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
        {t('ai.overview.costTitle')}
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Stat
          label={t('ai.overview.costTotal')}
          value={formatUsd(total.costTotalUsd)}
        />
        <Stat
          label={t('ai.overview.costTokens')}
          value={formatTokens(total.totalTokens)}
        />
        <Stat
          label={t('ai.overview.costRuns')}
          value={String(total.generationCount)}
        />
      </div>

      {breakdown.length ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {breakdown.map((capability) => {
            const meta = CAPABILITY_META[capability]
            const Icon = meta.icon
            return (
              <div className="contents" key={capability}>
                <dt className="inline-flex items-center gap-1.5 text-fg-muted">
                  <Icon aria-hidden="true" className="size-3" />
                  {t(meta.labelKey)}
                </dt>
                <dd className="tabular-nums text-fg">
                  {formatUsd(byResourceType[capability].costTotalUsd)}
                  <span className="ml-2 text-fg-subtle">
                    {t('ai.overview.costRunCount', {
                      count: byResourceType[capability].generationCount,
                    })}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      {models.length ? (
        <p
          className="mt-3 truncate text-xs text-fg-subtle"
          title={models.join(', ')}
        >
          {models.join(' · ')}
        </p>
      ) : null}
    </section>
  )
}

function Stat(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-base font-semibold tabular-nums text-fg">
        {props.value}
      </p>
      <p className="text-xs text-fg-subtle">{props.label}</p>
    </div>
  )
}
