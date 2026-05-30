import { Database } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function BackupDetailEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-72 items-center justify-center bg-surface-card px-4">
      <EmptyState
        description={t('backup.detailEmpty.description')}
        icon={Database}
        title={t('backup.detailEmpty.title')}
      />
    </div>
  )
}
