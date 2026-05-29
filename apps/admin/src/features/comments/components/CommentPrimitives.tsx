import { Popover } from '@base-ui/react/popover'
import { Inbox, SmilePlus } from 'lucide-react'
import { useState } from 'react'
import type { CommentModel } from '~/models/comment'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { commentQuickEmojis } from '../constants'

export function Avatar(props: { comment: CommentModel; size: 'lg' | 'sm' }) {
  const sizeClass = props.size === 'lg' ? 'size-12 text-base' : 'size-8 text-sm'

  if (props.comment.avatar) {
    return (
      <img
        alt=""
        className={cn('shrink-0 rounded-full object-cover', sizeClass)}
        src={props.comment.avatar}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-neutral-100 font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300',
        sizeClass,
      )}
    >
      {(props.comment.author || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

export function OwnerReplyAvatar(props: {
  avatar?: null | string
  name: string
}) {
  if (props.avatar) {
    return (
      <img
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
        src={props.avatar}
      />
    )
  }

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
      {props.name.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function MetaItem(props: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {props.label}
      </dt>
      <dd className="mt-1 min-w-0 text-neutral-900 dark:text-neutral-100">
        {props.children}
      </dd>
    </div>
  )
}

export function CommentEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Inbox
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('comments.empty')}
      </p>
    </div>
  )
}

export function EmojiPopover(props: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  return (
    <Popover.Root onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        aria-label={t('comments.reply.emojiPickerLabel')}
        className="inline-flex size-8 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        type="button"
      >
        <SmilePlus aria-hidden="true" className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" side="top" sideOffset={8}>
          <Popover.Popup className="outline-hidden z-50 grid w-64 grid-cols-8 gap-1 rounded border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            {commentQuickEmojis.map((emoji) => (
              <button
                className="flex size-7 items-center justify-center rounded text-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                key={emoji}
                onClick={() => {
                  props.onSelect(emoji)
                  setOpen(false)
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
