import { MailX } from 'lucide-react'

import { useI18n } from '~/i18n'

export function SubscribeEmptyState(props: { hasSearch: boolean }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <MailX
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {props.hasSearch
          ? t('subscribe.empty.search')
          : t('subscribe.empty.title')}
      </p>
      {!props.hasSearch ? (
        <p className="mt-2 text-sm text-neutral-400">
          {t('subscribe.empty.description')}
        </p>
      ) : null}
    </div>
  )
}
