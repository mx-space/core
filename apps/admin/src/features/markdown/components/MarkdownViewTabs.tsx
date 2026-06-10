import { FileDown, FileUp } from 'lucide-react'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

export type MarkdownView = 'export' | 'import'

interface MarkdownViewTabsProps {
  onChange: (next: MarkdownView) => void
  value: MarkdownView
}

interface TabDef {
  icon: typeof FileDown
  label: string
  value: MarkdownView
}

export function MarkdownViewTabs(props: MarkdownViewTabsProps) {
  const { t } = useI18n()

  const tabs: TabDef[] = [
    { icon: FileUp, label: t('markdown.import.tabLabel'), value: 'import' },
    { icon: FileDown, label: t('markdown.export.tabLabel'), value: 'export' },
  ]

  return (
    <div
      aria-label="markdown view"
      className="flex shrink-0 items-center gap-1 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800"
      role="tablist"
    >
      <div className="inline-flex items-center gap-1 rounded-sm border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
        {tabs.map((tab) => {
          const active = props.value === tab.value
          const Icon = tab.icon
          return (
            <button
              aria-selected={active}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-xs px-3 text-xs font-medium transition-colors',
                active
                  ? 'bg-neutral-950 text-white dark:bg-neutral-50 dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900',
              )}
              key={tab.value}
              onClick={() => props.onChange(tab.value)}
              role="tab"
              type="button"
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
