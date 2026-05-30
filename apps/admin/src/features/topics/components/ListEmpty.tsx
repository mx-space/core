import { Inbox } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'

export function ListEmpty(props: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-80 items-center justify-center px-4">
      <EmptyState
        action={
          <Button onClick={props.onCreate} type="button">
            {t('topics.empty.create')}
          </Button>
        }
        icon={Inbox}
        title={t('topics.empty.title')}
      />
    </div>
  )
}
