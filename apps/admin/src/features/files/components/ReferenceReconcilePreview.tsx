import type { FileReferenceReconciliationResult } from '~/api/files'
import { useI18n } from '~/i18n'

export function hasReferenceReconcileChanges(
  result: FileReferenceReconciliationResult,
) {
  return (
    result.missingReferences > 0 ||
    result.statusToActive > 0 ||
    result.statusToPending > 0 ||
    result.usageChanges > 0
  )
}

export async function runReferenceReconcileFlow(input: {
  confirm: (preview: FileReferenceReconciliationResult) => Promise<boolean>
  onUpToDate: (
    preview: FileReferenceReconciliationResult,
  ) => Promise<void> | void
  scan: (apply: boolean) => Promise<FileReferenceReconciliationResult>
}) {
  const preview = await input.scan(false)
  if (!hasReferenceReconcileChanges(preview)) {
    await input.onUpToDate(preview)
    return null
  }
  if (!(await input.confirm(preview))) return null
  return input.scan(true)
}

export function ReferenceReconcilePreview(props: {
  result: FileReferenceReconciliationResult
}) {
  const { t } = useI18n()
  const metrics = [
    {
      label: t('files.orphans.reconcileMetric.scanned'),
      value: props.result.scannedFiles,
    },
    {
      label: t('files.orphans.reconcileMetric.referenced'),
      value: props.result.referencedFiles,
    },
    {
      label: t('files.orphans.reconcileMetric.isolated'),
      value: props.result.isolatedFiles,
    },
    {
      label: t('files.orphans.reconcileMetric.usages'),
      value: props.result.usages,
    },
  ]
  const changes = [
    {
      label: t('files.orphans.reconcileChange.discovered'),
      value: props.result.missingReferences,
    },
    {
      label: t('files.orphans.reconcileChange.active'),
      value: props.result.statusToActive,
    },
    {
      label: t('files.orphans.reconcileChange.pending'),
      value: props.result.statusToPending,
    },
    {
      label: t('files.orphans.reconcileChange.usages'),
      value: props.result.usageChanges,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <div
            className="rounded-lg bg-surface-inset px-3 py-2.5"
            key={metric.label}
          >
            <div className="text-xs text-fg-subtle">{metric.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-fg">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium tracking-wide text-fg-muted uppercase">
          {t('files.orphans.reconcileChanges')}
        </div>
        <div className="overflow-hidden rounded-lg bg-surface-inset">
          {changes.map((change) => (
            <div
              className="flex min-h-9 items-center justify-between gap-4 border-b border-border/60 px-3 text-sm last:border-b-0"
              key={change.label}
            >
              <span className="text-fg-muted">{change.label}</span>
              <span className="font-medium tabular-nums text-fg">
                {change.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-pretty text-xs leading-relaxed text-fg-subtle">
        {t('files.orphans.reconcileSafetyNote')}
      </p>
    </div>
  )
}
