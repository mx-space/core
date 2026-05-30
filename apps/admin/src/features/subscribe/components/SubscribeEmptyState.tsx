import { MailX } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'

export function SubscribeEmptyState(props: { hasSearch: boolean }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center py-16">
      <EmptyState
        description={
          props.hasSearch ? undefined : t('subscribe.empty.description')
        }
        icon={MailX}
        title={
          props.hasSearch
            ? t('subscribe.empty.search')
            : t('subscribe.empty.title')
        }
      />
    </div>
  )
}
