import { Collapsible } from '@base-ui/react/collapsible'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { IpInfoPopover } from '~/features/_shared/components/ip-info-popover'
import { useI18n } from '~/i18n'
import type {
  CommentAuthorActivity,
  CommentAuthorActivityItem,
  CommentModel,
} from '~/models/comment'
import { cn } from '~/utils/cn'

import { formatCommentDate, getDeviceInfo } from '../utils/comments'
import { countryFlag } from '../utils/country-flag'

interface MetaSidebarProps {
  comment: CommentModel
  activity: CommentAuthorActivity | undefined
  activityLoading?: boolean
  /** Override the "View all N" navigation; default routes to /comments?author=. */
  onViewAllAuthor?: (authorKey: string) => void
}

export function MetaSidebar(props: MetaSidebarProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const authorKey = props.comment.mail || props.comment.ip || ''

  const handleViewAll = () => {
    if (props.onViewAllAuthor) {
      props.onViewAllAuthor(authorKey)
      return
    }
    if (!authorKey) return
    navigate(`/comments?author=${encodeURIComponent(authorKey)}`)
  }

  const activityCount = props.activity?.totalCount ?? 0

  return (
    <div className="flex flex-col">
      <DisclosureGroup defaultOpen title={t('comments.sidebar.identity')}>
        <IdentityBlock comment={props.comment} />
      </DisclosureGroup>

      <DisclosureGroup defaultOpen title={t('comments.sidebar.origin')}>
        <OriginBlock comment={props.comment} />
      </DisclosureGroup>

      <DisclosureGroup
        suffix={activityCount > 0 ? `· ${activityCount}` : undefined}
        title={t('comments.sidebar.activityBy', {
          author: props.comment.author || t('comments.anonymous'),
        })}
      >
        <ActivityBlock
          activity={props.activity}
          comment={props.comment}
          loading={props.activityLoading}
          onViewAll={authorKey ? handleViewAll : undefined}
        />
      </DisclosureGroup>

      <ThreatDisclosure
        activity={props.activity}
        loading={props.activityLoading}
        title={t('comments.sidebar.threatSignal')}
      />
    </div>
  )
}

function DisclosureGroup(props: {
  title: string
  suffix?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <Collapsible.Root
      className="border-t border-border/60 first:border-t-0"
      defaultOpen={props.defaultOpen}
    >
      <Collapsible.Trigger
        className={cn(
          'group flex w-full items-center gap-2 py-2 text-left',
          'text-[11px] font-medium uppercase tracking-wide text-fg-subtle',
          'hover:text-fg',
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className="size-3 text-fg-subtle transition-transform duration-150 group-data-[panel-open]:rotate-90"
        />
        <span className="truncate">{props.title}</span>
        {props.suffix ? (
          <span className="ml-1 text-fg-muted normal-case">{props.suffix}</span>
        ) : null}
      </Collapsible.Trigger>
      <Collapsible.Panel className="overflow-hidden text-[13px] text-fg">
        <div className="pb-3">{props.children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function IdentityBlock(props: { comment: CommentModel }) {
  const { t } = useI18n()
  const { comment } = props

  if (!comment.mail && !comment.url && !comment.id) {
    return (
      <p className="text-[13px] text-fg-muted">{t('comments.anonymous')}</p>
    )
  }

  return (
    <ul className="space-y-1">
      {comment.mail ? (
        <li>
          <a
            className="block min-w-0 truncate text-fg hover:underline"
            href={`mailto:${comment.mail}`}
          >
            {comment.mail}
          </a>
        </li>
      ) : null}
      {comment.url ? (
        <li>
          <a
            className="block min-w-0 truncate text-[12px] text-fg-muted hover:text-fg hover:underline"
            href={comment.url}
            rel="noreferrer"
            target="_blank"
          >
            {comment.url}
          </a>
        </li>
      ) : null}
      <li>
        <CopyableId id={comment.id} />
      </li>
    </ul>
  )
}

function CopyableId(props: { id: string }) {
  const { t } = useI18n()
  const handleCopy = () => {
    void navigator.clipboard?.writeText(props.id)
    toast.success(t('comments.toast.copied'))
  }
  return (
    <button
      aria-label={t('common.copy')}
      className="block w-full min-w-0 truncate text-left font-mono text-[11px] text-fg-muted hover:text-fg"
      onClick={handleCopy}
      type="button"
    >
      #{props.id}
    </button>
  )
}

function OriginBlock(props: { comment: CommentModel }) {
  const { t } = useI18n()
  const { comment } = props
  const device = getDeviceInfo(comment.agent)
  const flag = comment.countryCode ? countryFlag(comment.countryCode) : ''

  return (
    <ul className="space-y-1">
      <li>
        {comment.ip ? (
          <IpInfoPopover
            className="block min-w-0 truncate text-fg hover:underline"
            ip={comment.ip}
            trigger={
              <span className="truncate">
                {flag ? `${flag} ` : ''}
                {comment.ip}
              </span>
            }
          />
        ) : (
          <span className="block text-fg-muted">
            {t('comments.meta.unknown')}
          </span>
        )}
      </li>
      <li>
        <span
          className="block min-w-0 truncate text-[12px] text-fg-muted"
          title={comment.agent}
        >
          {device.label}
        </span>
      </li>
    </ul>
  )
}

function ActivityBlock(props: {
  activity: CommentAuthorActivity | undefined
  comment: CommentModel
  loading?: boolean
  onViewAll?: () => void
}) {
  const { t } = useI18n()

  if (props.loading && !props.activity) {
    return <SkeletonLines lines={3} />
  }

  if (!props.activity) {
    return <p className="text-[13px] text-fg-muted">{t('common.noData')}</p>
  }

  const { totalCount, items } = props.activity
  const visible = items.slice(0, 4)

  return (
    <div className="space-y-2">
      <ul className="space-y-0.5">
        {visible.map((item) => (
          <ActivityRow
            current={item.id === props.comment.id}
            item={item}
            key={item.id}
          />
        ))}
        {visible.length === 0 ? (
          <li className="text-[13px] text-fg-muted">
            {t('comments.sidebar.activityEmpty')}
          </li>
        ) : null}
      </ul>
      {totalCount > visible.length && props.onViewAll ? (
        <button
          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          onClick={props.onViewAll}
          type="button"
        >
          {t('comments.sidebar.viewAll', { count: totalCount })}
          <ArrowUpRight aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

function ActivityRow(props: {
  item: CommentAuthorActivityItem
  current: boolean
}) {
  const { t } = useI18n()
  return (
    <li
      className={cn(
        'border-l-2 pl-2 py-0.5',
        props.current ? 'border-accent' : 'border-transparent',
      )}
    >
      <span
        className={cn(
          'block min-w-0 truncate text-[12px]',
          props.current ? 'text-fg' : 'text-fg-muted',
        )}
      >
        {props.item.refTitle || t('comments.meta.unknown')}
        <span className="text-fg-subtle">
          {' · '}
          {formatCommentDate(props.item.createdAt)}
        </span>
      </span>
    </li>
  )
}

function ThreatDisclosure(props: {
  title: string
  activity: CommentAuthorActivity | undefined
  loading?: boolean
}) {
  const { t } = useI18n()
  const level = props.activity?.threatLevel

  const chipTone =
    level === 'trusted'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : level === 'risk'
        ? 'bg-red-500/10 text-red-700 dark:text-red-400'
        : 'bg-surface-inset text-fg-muted'

  const dotTone =
    level === 'trusted'
      ? 'bg-emerald-500'
      : level === 'risk'
        ? 'bg-red-500'
        : 'bg-fg-subtle'

  const summaryLabel = level
    ? t(`comments.threat.${level}`)
    : t('comments.meta.unknown')

  return (
    <Collapsible.Root className="border-t border-border/60" defaultOpen>
      <Collapsible.Trigger
        className={cn(
          'group flex w-full items-center gap-2 py-2 text-left',
          'text-[11px] font-medium uppercase tracking-wide text-fg-subtle',
          'hover:text-fg',
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className="size-3 text-fg-subtle transition-transform duration-150 group-data-[panel-open]:rotate-90"
        />
        <span className="flex-1 truncate">{props.title}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium normal-case',
            chipTone,
          )}
        >
          <span
            aria-hidden="true"
            className={cn('inline-block size-1.5 rounded-full', dotTone)}
          />
          {summaryLabel}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="overflow-hidden">
        <div className="pb-3 text-[12px] text-fg-muted">
          {props.loading && !props.activity ? (
            <SkeletonLines lines={1} />
          ) : props.activity?.threatReason ? (
            props.activity.threatReason
          ) : (
            t('common.noData')
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function SkeletonLines(props: { lines: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: props.lines }).map((_, idx) => (
        <div
          className="h-3 w-full animate-pulse rounded bg-surface-inset"
          key={idx}
        />
      ))}
    </div>
  )
}
