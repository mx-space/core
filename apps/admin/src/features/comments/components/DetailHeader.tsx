import { CheckCheck, ChevronRight, ShieldAlert, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { CommentModel } from '~/models/comment'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { getReferenceLink } from '../utils/comments'

interface DetailHeaderProps {
  comment: CommentModel
  onBack: () => void
  onMarkRead: () => void
  onMarkJunk: () => void
  onDelete: () => void
  canMarkRead: boolean
  canMarkJunk: boolean
  /** Optional mobile-only info toggle slot (tablet drawer trigger). */
  infoToggle?: ReactNode
}

export function DetailHeader(props: DetailHeaderProps) {
  const { t } = useI18n()
  const refLink = getReferenceLink(props.comment)
  const refTitle = props.comment.ref?.title

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-border px-4',
        APP_SHELL_HEADER_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileHeaderAffordance />
        <Button
          aria-label={t('comments.action.backToList')}
          className="h-8 w-8 p-0 lg:hidden"
          onClick={props.onBack}
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" className="size-4 rotate-180" />
        </Button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-fg">
            {props.comment.author || t('comments.anonymous')}
          </span>
          {refTitle ? (
            <span className="hidden truncate text-xs text-fg-muted sm:inline">
              {t('comments.source')}
              {' · '}
              {refLink ? (
                <a
                  className="hover:underline"
                  href={refLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  {refTitle}
                </a>
              ) : (
                refTitle
              )}
              {' · '}
              <span className="text-fg-subtle">
                {t(`comments.refType.${props.comment.refType}`)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {props.infoToggle}
        <ActionButton
          disabled={!props.canMarkRead}
          icon={<CheckCheck aria-hidden="true" className="size-3.5" />}
          label={t('comments.action.markRead')}
          onClick={props.onMarkRead}
          shortcut="⌥E"
        />
        <ActionButton
          disabled={!props.canMarkJunk}
          icon={<ShieldAlert aria-hidden="true" className="size-3.5" />}
          label={t('comments.action.markJunk')}
          onClick={props.onMarkJunk}
          shortcut="⌥J"
        />
        <ActionButton
          danger
          icon={<Trash2 aria-hidden="true" className="size-3.5" />}
          label={t('common.delete')}
          onClick={props.onDelete}
          shortcut="⌫"
        />
      </div>
    </div>
  )
}

function ActionButton(props: {
  icon: ReactNode
  label: string
  shortcut: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <Button
      className={cn(
        'h-8 gap-1.5 px-2',
        props.danger && 'text-red-600 dark:text-red-400',
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      title={`${props.label} (${props.shortcut})`}
      type="button"
      variant="subtle"
    >
      {props.icon}
      <span className="hidden sm:inline">{props.label}</span>
    </Button>
  )
}
