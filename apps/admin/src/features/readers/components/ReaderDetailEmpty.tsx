import { UserRoundSearch } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function ReaderDetailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        description={t('readers.detail.empty.hint')}
        icon={UserRoundSearch}
        title={t('readers.detail.empty.title')}
      />
    </div>
  )
}
