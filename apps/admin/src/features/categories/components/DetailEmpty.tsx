import { FolderOpen } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function DetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[28rem] items-center justify-center px-4">
      <EmptyState
        description={t('categories.detail.empty.description')}
        icon={FolderOpen}
        title={t('categories.detail.empty.title')}
      />
    </div>
  )
}
