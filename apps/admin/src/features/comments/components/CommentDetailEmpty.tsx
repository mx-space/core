import { MessageSquare } from 'lucide-react'

import { useI18n } from '~/i18n'

export function CommentDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center text-center text-sm text-neutral-500 dark:text-neutral-400">
      <MessageSquare
        aria-hidden="true"
        className="mb-3 size-10 text-neutral-300 dark:text-neutral-700"
      />
      {t('comments.detail.empty')}
    </div>
  )
}
