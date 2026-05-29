import { FolderOpen } from 'lucide-react'

import { useI18n } from '~/i18n'

export function DetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[28rem] items-center justify-center px-4 text-center">
      <div>
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-900">
          <FolderOpen aria-hidden="true" className="size-7" />
        </div>
        <h2 className="mt-4 text-base font-medium text-neutral-950 dark:text-neutral-50">
          {t('categories.detail.empty.title')}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t('categories.detail.empty.description')}
        </p>
      </div>
    </div>
  )
}
