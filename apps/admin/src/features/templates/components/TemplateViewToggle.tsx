import type { LucideIcon } from 'lucide-react'
import { Code2, Columns, Eye } from 'lucide-react'

import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { cn } from '~/utils/cn'

import type { TemplateViewMode } from '../types/templates'

interface ToggleEntry {
  value: TemplateViewMode
  labelKey: TranslationKey
  icon: LucideIcon
}

const entries: ToggleEntry[] = [
  { value: 'split', labelKey: 'templates.view.split', icon: Columns },
  { value: 'code', labelKey: 'templates.view.code', icon: Code2 },
  { value: 'preview', labelKey: 'templates.view.preview', icon: Eye },
]

interface TemplateViewToggleProps {
  hideSplit?: boolean
  onChange: (value: TemplateViewMode) => void
  value: TemplateViewMode
}

export function TemplateViewToggle(props: TemplateViewToggleProps) {
  const { t } = useI18n()
  const visible = props.hideSplit
    ? entries.filter((entry) => entry.value !== 'split')
    : entries

  return (
    <div
      aria-label={t('templates.view.aria')}
      className="inline-flex items-center rounded-sm border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950"
      role="radiogroup"
    >
      {visible.map((entry) => {
        const Icon = entry.icon
        const active = entry.value === props.value
        return (
          <button
            aria-checked={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-950'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
            )}
            key={entry.value}
            onClick={() => props.onChange(entry.value)}
            role="radio"
            type="button"
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">{t(entry.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
