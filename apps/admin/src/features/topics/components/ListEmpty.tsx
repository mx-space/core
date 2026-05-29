import { Inbox } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function ListEmpty(props: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <Inbox aria-hidden="true" className="size-9 text-neutral-300" />
      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('topics.empty.title')}
      </p>
      <Button className="mt-3" onClick={props.onCreate} type="button">
        {t('topics.empty.create')}
      </Button>
    </div>
  )
}
