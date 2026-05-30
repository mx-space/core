import { Check, CircleAlert, Mail, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useI18n } from '~/i18n'
import type { LinkModel } from '~/models/link'
import { LinkState, LinkType } from '~/models/link'
import { Button } from '~/ui/primitives/button'

import type { HealthEntry } from '../types/friends'
import { formatDate } from '../utils/friends'
import { Avatar } from './FriendsPrimitives'

export function FriendRow(props: {
  health?: HealthEntry
  link: LinkModel
  onAuditPass: () => void
  onAuditReason: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const { t } = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  return (
    <tr className="align-top transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar avatar={props.link.avatar} name={props.link.name} />
          <a
            className="font-medium text-fg hover:underline"
            href={props.link.url}
            rel="noreferrer"
            target="_blank"
          >
            {props.link.name}
          </a>
        </div>
      </td>
      <td className="max-w-[18rem] px-4 py-3 text-fg-muted">
        <span className="line-clamp-2">{props.link.description || '-'}</span>
      </td>
      <td className="max-w-[18rem] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <a
            className="truncate text-fg-muted hover:underline"
            href={props.link.url}
            rel="noreferrer"
            target="_blank"
          >
            {props.link.url}
          </a>
          {props.health ? (
            <span
              className={[
                'size-2 shrink-0 rounded-full',
                props.health.message ? 'bg-red-400' : 'bg-green-400',
              ].join(' ')}
              title={props.health.message || String(props.health.status)}
            />
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-fg-muted">
        {props.link.type === LinkType.Collection
          ? t('friends.row.typeCollection')
          : t('friends.row.typeFriend')}
      </td>
      <td className="px-4 py-3">
        {props.link.email ? (
          <a
            className="inline-flex items-center gap-1 text-fg-muted hover:underline"
            href={`mailto:${props.link.email}`}
          >
            <Mail aria-hidden="true" className="size-3.5" />
            {props.link.email}
          </a>
        ) : (
          <span className="text-fg-subtle">-</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
        {formatDate(props.link.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {props.link.state === LinkState.Audit ? (
            <>
              <Button
                className="h-8 px-2"
                onClick={props.onAuditPass}
                type="button"
                variant="subtle"
              >
                <Check aria-hidden="true" className="size-3.5" />
                {t('friends.row.pass')}
              </Button>
              <Button
                className="h-8 px-2"
                onClick={props.onAuditReason}
                type="button"
                variant="subtle"
              >
                <CircleAlert aria-hidden="true" className="size-3.5" />
                {t('friends.row.reason')}
              </Button>
            </>
          ) : null}
          <Button
            className="h-8 px-2"
            onClick={props.onEdit}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            {t('friends.row.edit')}
          </Button>
          <Button
            className="h-8 px-2 text-red-600 dark:text-red-400"
            onClick={() => {
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
              ? t('friends.row.confirm')
              : t('friends.row.remove')}
          </Button>
        </div>
      </td>
    </tr>
  )
}
