import { Check, ChevronDown } from 'lucide-react'
import { useMemo } from 'react'

import { useI18n } from '~/i18n'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { menuStyles } from '~/ui/overlay/menu-styles'
import { cn } from '~/utils/cn'

import { templateDescriptors } from '../constants'
import type { TemplateType } from '../types/templates'

interface TemplateSwitcherProps {
  dirty: boolean
  onChange: (next: TemplateType) => void
  type: TemplateType
}

/**
 * Title-as-switcher: the header shows the active template and opens a menu with
 * the fixed set of templates. Replaces the old master list column, which cost
 * ~220px of editor width to switch between three items.
 */
export function TemplateSwitcher(props: TemplateSwitcherProps) {
  const { t } = useI18n()

  const current = useMemo(
    () =>
      templateDescriptors.find((entry) => entry.value === props.type) ??
      templateDescriptors[0],
    [props.type],
  )
  const CurrentIcon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={t('templates.switcher.aria')}
        className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-surface-inset data-[popup-open]:bg-surface-inset"
        type="button"
      >
        <CurrentIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
        <span className="truncate text-lg font-semibold text-fg">
          {t(current.labelKey)}
        </span>
        {props.dirty ? (
          <span
            aria-label={t('templates.unsaved')}
            className="size-1.5 shrink-0 rounded-full bg-amber-500"
            title={t('templates.unsaved')}
          />
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-80" sideOffset={8}>
        <DropdownMenu.Group>
          <DropdownMenu.GroupLabel>
            {t('templates.title')}
          </DropdownMenu.GroupLabel>
          {templateDescriptors.map((entry) => {
            const Icon = entry.icon
            const active = entry.value === props.type
            return (
              <DropdownMenu.Item
                className={cn('items-start', active && 'bg-surface-inset')}
                key={entry.value}
                onClick={() => props.onChange(entry.value)}
              >
                <span className={cn(menuStyles.iconSlot, 'mt-0.5')}>
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">
                    {t(entry.labelKey)}
                  </span>
                  <span className={cn(menuStyles.desc, 'whitespace-normal')}>
                    {t(entry.descriptionKey)}
                  </span>
                </span>
                {active ? (
                  <Check
                    aria-hidden="true"
                    className={cn(menuStyles.indicatorRight, 'mt-0.5')}
                  />
                ) : null}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
