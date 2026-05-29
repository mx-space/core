import type { ExportConfig, ExportOptionId } from '../../types/markdown'

import { useI18n } from '~/i18n'
import { Checkbox } from '~/ui/primitives/checkbox'

import { exportOptions } from '../../constants'

interface ExportOptionsGridProps {
  onChange: (next: ExportConfig) => void
  value: ExportConfig
}

export function ExportOptionsGrid(props: ExportOptionsGridProps) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {exportOptions.map((option) => {
        const id = option.id as ExportOptionId
        const checked = props.value[id]
        return (
          <label
            className="flex cursor-pointer items-start gap-3 rounded p-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
            key={id}
          >
            <Checkbox
              checked={checked}
              className="mt-0.5"
              onCheckedChange={(next) =>
                props.onChange({ ...props.value, [id]: next })
              }
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {t(option.labelKey)}
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                {t(option.descriptionKey)}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
