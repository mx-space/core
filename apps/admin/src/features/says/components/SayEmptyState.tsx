import { Quote } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function SayEmptyState(props: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-900">
        <Quote aria-hidden="true" className="size-8 text-neutral-400" />
      </div>
      <h2 className="mb-1 text-lg font-medium text-neutral-900 dark:text-neutral-100">
        {t('says.empty.title')}
      </h2>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        {t('says.empty.description')}
      </p>
      <Button onClick={props.onCreate} type="button">
        {t('says.empty.cta')}
      </Button>
    </div>
  )
}
