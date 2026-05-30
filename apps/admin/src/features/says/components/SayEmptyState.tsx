import { Quote } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'

export function SayEmptyState(props: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <EmptyState
        action={
          <Button onClick={props.onCreate} type="button">
            {t('says.empty.cta')}
          </Button>
        }
        description={t('says.empty.description')}
        icon={Quote}
        title={t('says.empty.title')}
      />
    </div>
  )
}
