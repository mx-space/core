import { MessageSquare } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function CommentDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-72 items-center justify-center px-4">
      <EmptyState icon={MessageSquare} title={t('comments.detail.empty')} />
    </div>
  )
}
