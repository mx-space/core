import { Check, CircleDot, Loader2, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type {
  ActiveGeneration,
  AiOverviewCapability,
  ArticleCoverage,
} from '~/api/ai-overview'
import { AI_OVERVIEW_CAPABILITIES } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { cn } from '~/utils/cn'

import { CAPABILITY_META } from './capability-meta'
import type { CellState } from './coverage-cells'
import {
  coverageColumns,
  isCellActionable,
  normaliseLangInput,
  resolveCell,
} from './coverage-cells'

const CELL_CLASS: Record<CellState, string> = {
  has: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25',
  gap: 'border border-dashed border-border-strong text-fg-subtle hover:bg-surface-inset hover:text-fg',
  addable:
    'text-fg-subtle/35 hover:bg-surface-inset hover:text-fg focus-visible:text-fg',
  pending: 'bg-accent-soft text-accent',
  source: 'text-fg-subtle',
  na: 'text-fg-subtle/40',
}

const ARIA_KEY_BY_STATE: Record<CellState, TranslationKey> = {
  has: 'ai.overview.cell.openAria',
  gap: 'ai.overview.cell.generateAria',
  addable: 'ai.overview.cell.generateAria',
  pending: 'ai.overview.cell.pendingAria',
  source: 'ai.overview.cell.sourceAria',
  na: 'ai.overview.cell.naAria',
}

interface CoverageMatrixProps {
  coverage: ArticleCoverage
  activeTasks: ActiveGeneration[]
  activeKey: string | null
  extraColumns: string[]
  onAddColumn: (lang: string) => void
  onCellClick: (
    capability: AiOverviewCapability,
    lang: string,
    state: CellState,
  ) => void
}

export function CoverageMatrix(props: CoverageMatrixProps) {
  const { t } = useI18n()
  const columns = coverageColumns(props.coverage, props.extraColumns)

  return (
    <div className="overflow-x-auto">
      {columns.length ? null : (
        <p className="mb-2 text-xs text-fg-muted">
          {t('ai.overview.matrixEmpty')}
        </p>
      )}
      <table className="border-separate border-spacing-x-1 border-spacing-y-0.5">
        <thead>
          <tr>
            <th />
            {columns.map((lang) => (
              <th
                className="px-1 text-xs font-medium text-fg-subtle"
                key={lang}
                scope="col"
              >
                {lang}
              </th>
            ))}
            <th className="px-1" scope="col">
              <AddColumnControl onAdd={props.onAddColumn} />
            </th>
          </tr>
        </thead>
        <tbody>
          {AI_OVERVIEW_CAPABILITIES.map((capability) => {
            const meta = CAPABILITY_META[capability]
            const Icon = meta.icon
            return (
              <tr key={capability}>
                <th
                  className="whitespace-nowrap pr-2 text-left text-xs font-normal text-fg-muted"
                  scope="row"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon aria-hidden="true" className="size-3.5" />
                    {t(meta.labelKey)}
                  </span>
                </th>
                {columns.map((lang) => {
                  const state = resolveCell(
                    props.coverage,
                    capability,
                    lang,
                    props.activeTasks,
                  )
                  const key = `${capability}:${lang}`
                  const interactive = isCellActionable(state)
                  const label = t(ARIA_KEY_BY_STATE[state], {
                    kind: t(meta.labelKey),
                    lang,
                  })
                  return (
                    <td key={lang}>
                      <button
                        aria-label={label}
                        title={label}
                        className={cn(
                          'flex size-6 items-center justify-center rounded-xs text-xs transition-colors',
                          'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                          CELL_CLASS[state],
                          !interactive && 'cursor-default',
                          props.activeKey === key &&
                            'ring-2 ring-accent ring-offset-0',
                        )}
                        disabled={!interactive}
                        onClick={() =>
                          props.onCellClick(capability, lang, state)
                        }
                        type="button"
                      >
                        {renderGlyph(state)}
                      </button>
                    </td>
                  )
                })}
                <td />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AddColumnControl(props: { onAdd: (lang: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const commit = () => {
    const lang = normaliseLangInput(value)
    if (!lang) {
      toast.error(t('ai.overview.addLangInvalid'))
      return
    }
    props.onAdd(lang)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        aria-label={t('ai.overview.addLang')}
        className="inline-flex size-6 items-center justify-center rounded-xs text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onClick={() => setOpen(true)}
        title={t('ai.overview.addLang')}
        type="button"
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
    )
  }

  return (
    <input
      aria-label={t('ai.overview.addLang')}
      autoFocus
      className="w-12 rounded-xs border border-border bg-surface-card px-1 py-0.5 text-center text-xs text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
      onBlur={() => setOpen(false)}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setOpen(false)
      }}
      placeholder={t('ai.overview.addLangPlaceholder')}
      value={value}
    />
  )
}

function renderGlyph(state: CellState) {
  switch (state) {
    case 'has': {
      return <Check aria-hidden="true" className="size-3.5" />
    }
    case 'gap':
    case 'addable': {
      return <Plus aria-hidden="true" className="size-3.5" />
    }
    case 'pending': {
      return <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
    }
    case 'source': {
      return <CircleDot aria-hidden="true" className="size-3" />
    }
    case 'na': {
      return <Minus aria-hidden="true" className="size-3" />
    }
  }
}
