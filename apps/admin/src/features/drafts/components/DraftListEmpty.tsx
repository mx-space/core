import { Inbox } from 'lucide-react'

import { useI18n } from '~/i18n'

export function DraftListEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <Inbox aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {t('drafts.empty.title')}
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        {t('drafts.empty.description')}
      </p>
    </div>
  )
}
