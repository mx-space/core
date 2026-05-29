import { AlertCircle, CheckCircle2, Eraser } from 'lucide-react'
import type { ProbeHistoryEntry } from '../types/enrichment'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { ListEmpty } from './EnrichmentPrimitives'

export function ProbeListPanel(props: {
  history: ProbeHistoryEntry[]
  onClear: () => void
  onSelect: (entry: ProbeHistoryEntry) => void
  selectedId: null | string
}) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('enrichment.probe.historyCount', { count: props.history.length })}
        </span>
        <Button
          disabled={props.history.length === 0}
          onClick={props.onClear}
          type="button"
          variant="subtle"
        >
          <Eraser aria-hidden="true" className="size-4" />
          {t('enrichment.probe.clear')}
        </Button>
      </div>
      <Scroll className="flex-1">
        {props.history.length === 0 ? (
          <ListEmpty label={t('enrichment.probe.empty')} />
        ) : (
          props.history.map((entry) => (
            <button
              className={cn(
                'flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-800/50',
                props.selectedId === entry.id
                  ? 'bg-neutral-100 dark:bg-neutral-900'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
              )}
              key={entry.id}
              onClick={() => props.onSelect(entry)}
              type="button"
            >
              {entry.result.error ? (
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-4 text-red-500"
                />
              ) : (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-4 text-emerald-500"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {entry.result.matched?.provider ?? 'unknown'}
                </h3>
                <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {entry.url}
                </p>
              </div>
            </button>
          ))
        )}
      </Scroll>
    </div>
  )
}
