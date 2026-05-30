import { Search } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function SearchIndexDetailEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-72 items-center justify-center px-6">
      <EmptyState icon={Search} title={t('searchIndex.empty.detail')} />
    </div>
  )
}
