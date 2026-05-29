import type { TranslationKey } from '~/i18n/types'

import { useI18n } from '~/i18n'
import { Badge } from '~/ui/primitives/badge'

import { refTypeLabelKeys, refTypeTones } from '../constants'

export function RefTypeBadge(props: { refType: string }) {
  const { t } = useI18n()
  const labelKey = refTypeLabelKeys[props.refType] as TranslationKey | undefined
  return (
    <Badge tone={refTypeTones[props.refType] ?? 'neutral'}>
      {labelKey ? t(labelKey) : props.refType}
    </Badge>
  )
}
