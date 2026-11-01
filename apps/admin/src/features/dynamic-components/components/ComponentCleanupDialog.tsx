import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import { ModalFooter, ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

import type {
  ComponentCleanupResult,
  ComponentCleanupSelection,
} from '../utils/component-cleanup'
import { runComponentCleanup } from '../utils/component-cleanup'
import type {
  CleanupGroup,
  ComponentCleanupCandidate,
  ComponentUsageReport,
} from '../utils/component-usage'

const GROUPS: CleanupGroup[] = [
  'unusedEntries',
  'unusedVersions',
  'unregisteredFiles',
  'draftOnly',
]

export function ComponentCleanupPanel(props: {
  onCancel: () => void
  onConfirm: (selection: ComponentCleanupSelection) => void
  pending: boolean
  report: ComponentUsageReport
}) {
  const { t } = useI18n()
  const all = GROUPS.flatMap((group) => props.report.candidates[group])
  const [picked, setPicked] = useState(
    () =>
      new Set(all.filter((item) => item.preChecked).map((item) => item.key)),
  )
  const selection = all.filter((item) => picked.has(item.key))
  const selectedBytes = selection.reduce((sum, item) => sum + item.bytes, 0)
  const toggle = (keys: string[], on: boolean) =>
    setPicked((current) => {
      const next = new Set(current)
      for (const key of keys) {
        if (on) next.add(key)
        else next.delete(key)
      }
      return next
    })
  const draftTitles = (item: ComponentCleanupCandidate) => {
    const entry = props.report.entries.find(
      (report) =>
        item.action?.type === 'entry' && report.entryId === item.action.entryId,
    )
    const titles = entry?.versions.flatMap(
      (version) => version.usage?.drafts.map((draft) => draft.title) ?? [],
    )
    return [...new Set(titles)].join(' / ')
  }

  return (
    <div className="flex max-h-[80vh] w-full flex-col">
      <div className="flex flex-col gap-1 px-6 pt-5 pb-4">
        <ModalTitle className="text-lg font-semibold text-fg">
          {t('dynamicComponents.cleanup.title')}
        </ModalTitle>
        <p className="text-sm text-fg-muted">
          {t('dynamicComponents.cleanup.subtitle')}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {all.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-fg-subtle">
            {t('dynamicComponents.cleanup.empty')}
          </p>
        ) : null}
        {GROUPS.map((group) => {
          const items = props.report.candidates[group]
          if (items.length === 0) return null
          const keys = items.map((item) => item.key)
          const checkedCount = keys.filter((key) => picked.has(key)).length
          const warn = group === 'draftOnly'
          return (
            <section className="border-b border-border" key={group}>
              <label className="flex items-center gap-3 bg-surface-inset/60 px-6 py-2.5">
                <Checkbox
                  checked={checkedCount === keys.length}
                  disabled={warn}
                  indeterminate={checkedCount > 0 && checkedCount < keys.length}
                  onCheckedChange={(checked) => toggle(keys, checked)}
                />
                <span
                  className={cn(
                    'flex-1 text-sm font-medium',
                    warn ? 'text-amber-700 dark:text-amber-400' : 'text-fg',
                  )}
                >
                  {t(`dynamicComponents.cleanup.group.${group}`)} ·{' '}
                  {items.length}
                </span>
                {warn ? (
                  <span className="text-xs text-fg-subtle">
                    {t('dynamicComponents.cleanup.draftOnlyHint')}
                  </span>
                ) : (
                  <span className="text-xs tabular-nums text-fg-muted">
                    {formatBytes(
                      items.reduce((sum, item) => sum + item.bytes, 0),
                    )}
                  </span>
                )}
              </label>
              {items.map((item) => (
                <label
                  className="flex items-start gap-3 px-6 py-2.5 pl-12"
                  data-candidate={item.key}
                  key={item.key}
                >
                  <Checkbox
                    checked={picked.has(item.key)}
                    className="mt-0.5"
                    disabled={warn}
                    onCheckedChange={(checked) => toggle([item.key], checked)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-fg">
                      {item.label}
                      {item.action?.type === 'previousUrl' ? (
                        <span className="text-fg-subtle">
                          {' '}
                          · {t('dynamicComponents.cleanup.oldVersion')}
                        </span>
                      ) : null}
                    </span>
                    {warn ? (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {t('dynamicComponents.cleanup.draftWarning', {
                          titles: draftTitles(item),
                        })}
                      </span>
                    ) : (
                      <span className="truncate font-mono text-xs text-fg-subtle">
                        {item.urls.map(fileNameOf).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="text-xs tabular-nums text-fg-muted">
                    {formatBytes(item.bytes)}
                  </span>
                </label>
              ))}
            </section>
          )
        })}
      </div>
      <ModalFooter className="px-6">
        <span className="mr-auto text-sm text-fg-muted" data-cleanup-total="">
          {t('dynamicComponents.cleanup.selected', {
            count: selection.length,
            size: formatBytes(selectedBytes),
          })}
        </span>
        <Button onClick={props.onCancel} variant="secondary">
          {t('common.cancel')}
        </Button>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          disabled={props.pending || selection.length === 0}
          onClick={() => props.onConfirm(selection)}
        >
          {props.pending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('dynamicComponents.cleanup.run', { count: selection.length })}
        </Button>
      </ModalFooter>
    </div>
  )
}

function fileNameOf(url: string) {
  return url.split('/').slice(-2).join('/')
}

export function useRunComponentCleanup(
  onSettled?: (result: ComponentCleanupResult) => void,
) {
  const { t } = useI18n()
  return useMutation({
    mutationFn: (selection: ComponentCleanupSelection) =>
      runComponentCleanup(selection),
    onError: () => toast.error(t('dynamicComponents.cleanup.failed')),
    onSuccess: (result) => {
      toast.success(
        t('dynamicComponents.cleanup.done', { count: result.deleted.length }),
      )
      if (result.restored.length)
        toast.warning(
          t('dynamicComponents.cleanup.restored', {
            count: result.restored.length,
          }),
        )
      if (result.dropped.length)
        toast.info(
          t('dynamicComponents.cleanup.dropped', {
            count: result.dropped.length,
          }),
        )
      onSettled?.(result)
    },
  })
}

function ComponentCleanupDialogBody(props: { report: ComponentUsageReport }) {
  const modal = useModal<ComponentCleanupResult>()
  const run = useRunComponentCleanup((result) => modal.close(result))
  return (
    <ComponentCleanupPanel
      onCancel={() => modal.dismiss()}
      onConfirm={(selection) => run.mutate(selection)}
      pending={run.isPending}
      report={props.report}
    />
  )
}

export function openComponentCleanupDialog(report: ComponentUsageReport) {
  return present<{ report: ComponentUsageReport }, ComponentCleanupResult>(
    ComponentCleanupDialogBody,
    { report },
    { modalProps: { popupStyle: { width: 'min(94vw, 40rem)' } } },
  )
}
