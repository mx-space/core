import type { TranslationKey } from '~/i18n/types'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { refTypeClassNames, refTypeLabelKeys } from '../constants'

export function RefTypeBadge(props: { refType: string }) {
  const { t } = useI18n()
  const labelKey = refTypeLabelKeys[props.refType] as TranslationKey | undefined
  return (
    <span
      className={cn(
        'inline-flex rounded border px-2 py-1 text-xs font-medium',
        refTypeClassNames[props.refType] ??
          'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
      )}
    >
      {labelKey ? t(labelKey) : props.refType}
    </span>
  )
}
