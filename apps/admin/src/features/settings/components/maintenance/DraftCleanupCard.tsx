import { useQuery } from '@tanstack/react-query'
import { Archive } from 'lucide-react'
import { useNavigate } from 'react-router'

import { getDraftStorage } from '~/api/drafts'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'

export function DraftCleanupCard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const storageQuery = useQuery({
    queryFn: () => getDraftStorage(),
    queryKey: adminQueryKeys.drafts.storage('all'),
  })

  return (
    <div className="bg-surface-card p-4">
      <Archive className="mb-3 size-5 text-fg-subtle" />
      <div className="text-sm text-fg-muted">
        {t('settings.maintenance.draftCleanup.label')}
      </div>
      <div className="mt-1 text-lg font-semibold text-fg">
        {storageQuery.data
          ? t('settings.maintenance.draftCleanup.value', {
              size: formatBytes(storageQuery.data.reclaimableBytes),
            })
          : '—'}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">
        {t('settings.maintenance.draftCleanup.description')}
      </p>
      <Button
        className="mt-3"
        onClick={() => navigate('/drafts?cleanup=1')}
        type="button"
        variant="subtle"
      >
        {t('settings.maintenance.draftCleanup.action')}
      </Button>
    </div>
  )
}
