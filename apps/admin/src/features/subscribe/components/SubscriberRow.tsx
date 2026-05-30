import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { Subscriber } from '~/api/subscribe'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'

import { formatDate } from '../utils/format'
import { SubscribeTags } from './SubscribeTags'

export function SubscriberRow(props: {
  onDelete: () => void
  onSelect: (checked: boolean) => void
  selected: boolean
  subscriber: Subscriber
}) {
  const { t } = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  return (
    <article
      className={[
        'group relative flex cursor-default items-center gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-b-0',
        props.selected ? 'bg-accent-soft text-fg' : 'hover:bg-surface-inset',
      ].join(' ')}
      onClick={() => props.onSelect(!props.selected)}
    >
      <Checkbox
        aria-label={t('subscribe.row.selectAria')}
        checked={props.selected}
        onCheckedChange={props.onSelect}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-neutral-800 dark:text-neutral-100">
          {props.subscriber.email}
        </div>
        <div className="mt-1 sm:hidden">
          <SubscribeTags subscribe={props.subscriber.subscribe} />
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        <SubscribeTags subscribe={props.subscriber.subscribe} />
      </div>
      <time
        className="w-24 shrink-0 text-right text-xs tabular-nums text-neutral-400"
        dateTime={props.subscriber.createdAt}
      >
        {formatDate(props.subscriber.createdAt)}
      </time>
      <Button
        aria-label={t('subscribe.row.deleteAria')}
        className="h-8 px-2 text-red-600 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 dark:text-red-400"
        onClick={(event) => {
          event.stopPropagation()
          if (isConfirmingDelete) {
            props.onDelete()
            setIsConfirmingDelete(false)
          } else {
            setIsConfirmingDelete(true)
          }
        }}
        onMouseLeave={() => setIsConfirmingDelete(false)}
        type="button"
        variant="subtle"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        {isConfirmingDelete
          ? t('subscribe.row.confirm')
          : t('subscribe.row.delete')}
      </Button>
    </article>
  )
}
