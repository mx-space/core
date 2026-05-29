import { Pencil, Quote, Trash2, User } from 'lucide-react'
import { useState } from 'react'
import type { SayModel } from '~/models/say'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { formatSayDate } from '../utils/format'

export function SayListItem(props: {
  onDelete: (id: string) => void
  onEdit: () => void
  say: SayModel
}) {
  const { t } = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  return (
    <article className="group border-b border-neutral-200 px-4 py-4 transition-colors last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50">
      <div className="flex gap-3">
        <Quote
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-neutral-300 dark:text-neutral-600"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
            {props.say.text}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
            {props.say.author ? (
              <span className="flex items-center gap-1">
                <User aria-hidden="true" className="size-3.5" />
                {props.say.author}
              </span>
            ) : null}
            {props.say.source ? (
              <span className="text-neutral-400 dark:text-neutral-500">
                -- {props.say.source}
              </span>
            ) : null}
            {props.say.createdAt ? (
              <time
                className="text-neutral-400 dark:text-neutral-500"
                dateTime={props.say.createdAt}
              >
                {formatSayDate(props.say.createdAt)}
              </time>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            aria-label={t('says.actions.editAria')}
            className="h-8 px-2"
            onClick={props.onEdit}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">{t('says.actions.edit')}</span>
          </Button>
          <Button
            aria-label={t('says.actions.deleteAria')}
            className="h-8 px-2 text-red-600 hover:text-red-700 dark:text-red-400"
            onClick={() => {
              if (isConfirmingDelete) {
                props.onDelete(props.say.id)
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
            <span className="hidden sm:inline">
              {isConfirmingDelete
                ? t('says.actions.confirm')
                : t('says.actions.delete')}
            </span>
          </Button>
        </div>
      </div>
    </article>
  )
}
