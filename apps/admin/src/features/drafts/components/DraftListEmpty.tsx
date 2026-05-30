import { Inbox } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function DraftListEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        description={t('drafts.empty.description')}
        icon={Inbox}
        title={t('drafts.empty.title')}
      />
    </div>
  )
}
