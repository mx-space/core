import { Search } from 'lucide-react'

import { useI18n } from '~/i18n'

export function SearchIndexEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <Search
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('searchIndex.empty.list')}
      </p>
    </div>
  )
}
