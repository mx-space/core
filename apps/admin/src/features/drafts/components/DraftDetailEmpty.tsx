import { Inbox } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function DraftDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] items-center justify-center px-4">
      <EmptyState icon={Inbox} title={t('drafts.detail.empty')} />
    </div>
  )
}
