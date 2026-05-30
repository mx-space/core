import { SearchX, Users } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

interface ReadersListEmptyProps {
  hasSearch: boolean
}

export function ReadersListEmpty(props: ReadersListEmptyProps) {
  const { t } = useI18n()
  const Icon = props.hasSearch ? SearchX : Users

  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        icon={Icon}
        title={
          props.hasSearch ? t('readers.empty.search') : t('readers.empty.title')
        }
      />
    </div>
  )
}
