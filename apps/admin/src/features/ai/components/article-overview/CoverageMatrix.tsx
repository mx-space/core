import {
  AlertTriangle,
  Check,
  CircleDot,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react'

import type {
  ActiveGeneration,
  AiOverviewCapability,
  ArticleCoverage,
} from '~/api/ai-overview'
import { AI_OVERVIEW_CAPABILITIES } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { cn } from '~/utils/cn'

import { AddLanguageControl } from './AddLanguageControl'
import { CAPABILITY_META } from './capability-meta'
import type { CellState } from './coverage-cells'
import {
  coverageColumns,
  isCellActionable,
  resolveCell,
} from './coverage-cells'

const QUICK_LANGS = ['zh', 'en', 'ja']

const CELL_CLASS: Record<CellState, string> = {
  has: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25',
  gap: 'border border-dashed border-border-strong text-fg-subtle hover:bg-surface-inset hover:text-fg',
  addable:
    'text-fg-subtle/35 hover:bg-surface-inset hover:text-fg focus-visible:text-fg',
  pending: 'bg-accent-soft text-accent',
  failed: 'bg-red-500/12 text-red-600 hover:bg-red-500/20 dark:text-red-400',
  source: 'text-fg-subtle',
  na: 'text-fg-subtle/40',
}

const ARIA_KEY_BY_STATE: Record<CellState, TranslationKey> = {
  has: 'ai.overview.cell.openAria',
  gap: 'ai.overview.cell.generateAria',
  addable: 'ai.overview.cell.generateAria',
  pending: 'ai.overview.cell.pendingAria',
  failed: 'ai.overview.cell.failedAria',
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
  // A task's languages earn a column of their own: without one, a running or
  // failed generation has nowhere to render and the matrix contradicts the
  // list right below it.
  const columns = coverageColumns(props.coverage, [
    ...props.extraColumns,
    ...props.activeTasks.flatMap((task) => task.langs),
  ])

  // A table with no data columns degenerates into a bare list of row labels
  // with nothing to click, so the empty case gets its own prompt instead.
  if (!columns.length) {
    return <PickLanguagePrompt onAdd={props.onAddColumn} />
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th />
            {columns.map((lang) => (
              <th
                className="px-1 pb-1.5 text-xs font-medium text-fg-subtle"
                key={lang}
                scope="col"
              >
                {lang}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AI_OVERVIEW_CAPABILITIES.map((capability) => {
            const meta = CAPABILITY_META[capability]
            const Icon = meta.icon
            return (
              <tr
                className="border-t border-border/60 first:border-t-0"
                key={capability}
              >
                <th
                  className="whitespace-nowrap pr-4 text-left text-xs font-normal text-fg-muted"
                  scope="row"
                >
                  <span className="inline-flex h-8 items-center gap-1.5">
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
                    <td className="px-1 text-center" key={lang}>
                      <button
                        aria-label={label}
                        className={cn(
                          'inline-flex size-6 items-center justify-center rounded-xs transition-colors',
                          'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                          CELL_CLASS[state],
                          !interactive && 'cursor-default',
                          props.activeKey === key && 'ring-2 ring-accent',
                        )}
                        disabled={!interactive}
                        onClick={() =>
                          props.onCellClick(capability, lang, state)
                        }
                        title={label}
                        type="button"
                      >
                        {renderGlyph(state)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PickLanguagePrompt(props: { onAdd: (lang: string) => void }) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <p className="text-sm font-medium text-fg">
        {t('ai.overview.pickLangTitle')}
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-fg-muted">
        {t('ai.overview.pickLangDescription')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {QUICK_LANGS.map((lang) => (
          <button
            className="rounded-sm border border-border px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
            key={lang}
            onClick={() => props.onAdd(lang)}
            type="button"
          >
            {lang}
          </button>
        ))}
        <AddLanguageControl labelled onAdd={props.onAdd} />
      </div>
    </div>
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
    case 'failed': {
      return <AlertTriangle aria-hidden="true" className="size-3.5" />
    }
    case 'source': {
      return <CircleDot aria-hidden="true" className="size-3" />
    }
    case 'na': {
      return <Minus aria-hidden="true" className="size-3" />
    }
  }
}
