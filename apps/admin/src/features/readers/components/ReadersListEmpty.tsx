import { SearchX, Users } from 'lucide-react'

import { useI18n } from '~/i18n'

interface ReadersListEmptyProps {
  hasSearch: boolean
}

export function ReadersListEmpty(props: ReadersListEmptyProps) {
  const { t } = useI18n()
  const Icon = props.hasSearch ? SearchX : Users

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <Icon aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {props.hasSearch ? t('readers.empty.search') : t('readers.empty.title')}
      </p>
    </div>
  )
}
