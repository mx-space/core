import { UserRoundSearch } from 'lucide-react'

import { useI18n } from '~/i18n'

export function ReaderDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <UserRoundSearch aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('readers.detail.empty.title')}
      </p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t('readers.detail.empty.hint')}
      </p>
    </div>
  )
}
