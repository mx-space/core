import { useI18n } from '~/i18n'
import type { BadgeTone } from '~/ui/primitives/badge'
import { Badge } from '~/ui/primitives/badge'

import type { ComponentEntryReport } from '../utils/component-usage'

const TONE: Record<ComponentEntryReport['status'], BadgeTone> = {
  draftOnly: 'warning',
  historyOnly: 'neutral',
  otherOnly: 'info',
  unused: 'neutral',
  used: 'success',
}

export function ComponentUsageBadge(props: {
  report: Pick<ComponentEntryReport, 'publishedCount' | 'status'>
}) {
  const { t } = useI18n()
  const { publishedCount, status } = props.report
  return (
    <Badge
      className={status === 'unused' ? 'border-dashed' : undefined}
      pill
      size="sm"
      tone={TONE[status]}
      variant={status === 'unused' ? 'outline' : 'soft'}
    >
      {status === 'used'
        ? t('dynamicComponents.usage.status.used', { count: publishedCount })
        : t(`dynamicComponents.usage.status.${status}`)}
    </Badge>
  )
}
