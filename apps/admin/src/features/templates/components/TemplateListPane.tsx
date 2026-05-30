import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { templateDescriptors } from '../constants'
import type { TemplateType } from '../types/templates'

interface TemplateListPaneProps {
  dirtyType: TemplateType | null
  onSelect: (value: TemplateType) => void
  selected: TemplateType
}

export function TemplateListPane(props: TemplateListPaneProps) {
  const { t } = useI18n()

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <h2 className="truncate text-lg font-semibold">
            {t('templates.title')}
          </h2>
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {templateDescriptors.length}
        </span>
      </div>

      <Scroll className="flex-1">
        <ul role="list">
          {templateDescriptors.map((entry) => {
            const Icon = entry.icon
            const active = entry.value === props.selected
            const dirty = props.dirtyType === entry.value
            return (
              <li key={entry.value}>
                <button
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'group relative flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left text-sm transition-colors',
                    active
                      ? 'border-l-neutral-950 bg-neutral-100 text-neutral-950 dark:border-l-neutral-50 dark:bg-neutral-900 dark:text-neutral-50'
                      : 'border-l-transparent text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900/60',
                  )}
                  onClick={() => props.onSelect(entry.value)}
                  type="button"
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0',
                      active
                        ? 'text-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-400',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {t(entry.labelKey)}
                  </span>
                  {dirty ? (
                    <span
                      aria-label={t('templates.unsaved')}
                      className="size-1.5 shrink-0 rounded-full bg-amber-500"
                      title={t('templates.unsaved')}
                    />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </Scroll>
    </section>
  )
}
