import type { ConfigFormField } from '~/api/options'

import { Toggle } from '~/ui/primitives/switch'
import { cn } from '~/utils/cn'

import { renderConfigControl } from './renderConfigControl'

export function ConfigFieldEditor(props: {
  field: ConfigFormField
  onAction: (actionId: string) => void
  onChange: (value: unknown) => void
  value: unknown
}) {
  const { field } = props
  const isSwitch = field.ui.component === 'switch'

  return (
    <div className="grid items-start gap-x-8 gap-y-2 md:grid-cols-2">
      <div className="min-w-0 md:pt-1.5">
        <div className="text-sm text-neutral-800 dark:text-neutral-200">
          {field.title}
          {field.required ? (
            <span className="ml-0.5 text-red-500">*</span>
          ) : null}
        </div>
        {field.description ? (
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {field.description}
          </p>
        ) : null}
      </div>
      <div
        className={cn('min-w-0', isSwitch && 'md:flex md:justify-end md:pt-1')}
      >
        {isSwitch ? (
          <Toggle
            aria-label={field.title}
            checked={Boolean(props.value)}
            onCheckedChange={props.onChange}
          />
        ) : (
          renderConfigControl(props)
        )}
      </div>
    </div>
  )
}
