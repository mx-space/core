import { Hash } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function TopicDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[28rem] items-center justify-center px-4">
      <EmptyState
        description={t('topics.detail.empty.description')}
        icon={Hash}
        title={t('topics.detail.empty.title')}
      />
    </div>
  )
}
