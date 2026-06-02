import {
  ArrowUpRight,
  Globe,
  Hash,
  Mail,
  MapPin,
  Monitor,
  Smartphone,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

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

  return (
    <div className="space-y-3 text-sm">
      <Section title={t('comments.sidebar.identity')}>
        <IdentityBlock comment={props.comment} />
      </Section>

      <Section title={t('comments.sidebar.origin')}>
        <OriginBlock comment={props.comment} />
      </Section>

      <Section
        title={t('comments.sidebar.activityBy', {
          author: props.comment.author || t('comments.anonymous'),
        })}
      >
        <ActivityBlock
          activity={props.activity}
          authorKey={authorKey}
          comment={props.comment}
          loading={props.activityLoading}
          onViewAll={authorKey ? handleViewAll : undefined}
        />
      </Section>

      <Section title={t('comments.sidebar.threatSignal')}>
        <ThreatBlock
          activity={props.activity}
          loading={props.activityLoading}
        />
      </Section>
    </div>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium text-fg-subtle">{props.title}</h3>
      <div className="space-y-1.5 text-sm">{props.children}</div>
    </section>
  )
}

function IdentityBlock(props: { comment: CommentModel }) {
  const { t } = useI18n()
  const { comment } = props

  if (!comment.mail && !comment.url) {
    return <p className="text-sm text-fg-muted">{t('comments.anonymous')}</p>
  }

  return (
    <ul className="space-y-1.5">
      {comment.mail ? (
        <li>
          <a
            className="inline-flex min-w-0 items-center gap-1.5 text-fg hover:underline"
            href={`mailto:${comment.mail}`}
          >
            <Mail
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-subtle"
            />
            <span className="truncate">{comment.mail}</span>
          </a>
        </li>
      ) : null}
      {comment.url ? (
        <li>
          <a
            className="inline-flex min-w-0 items-center gap-1.5 text-fg hover:underline"
            href={comment.url}
            rel="noreferrer"
            target="_blank"
          >
            <Globe
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-subtle"
            />
            <span className="truncate">{comment.url}</span>
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
  }
  return (
    <button
      aria-label={t('common.copy')}
      className="inline-flex items-center gap-1.5 text-fg-muted hover:text-fg"
      onClick={handleCopy}
      type="button"
    >
      <Hash aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
      <span className="truncate">{props.id}</span>
    </button>
  )
}

function OriginBlock(props: { comment: CommentModel }) {
  const { t } = useI18n()
  const { comment } = props
  const device = getDeviceInfo(comment.agent)
  const flag = comment.countryCode ? countryFlag(comment.countryCode) : ''

  return (
    <ul className="space-y-1.5">
      <li>
        {comment.ip ? (
          <IpInfoPopover
            className="inline-flex min-w-0 items-center gap-1.5 text-fg hover:underline"
            ip={comment.ip}
            trigger={
              <>
                <MapPin
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-fg-subtle"
                />
                <span className="truncate">
                  {flag ? `${flag} ` : ''}
                  {comment.ip}
                </span>
              </>
            }
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-fg-muted">
            <MapPin
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-subtle"
            />
            {t('comments.meta.unknown')}
          </span>
        )}
      </li>
      <li>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-fg-muted">
          {device.isMobile ? (
            <Smartphone
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-subtle"
            />
          ) : (
            <Monitor
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-subtle"
            />
          )}
          <span className="truncate" title={comment.agent}>
            {device.label}
          </span>
        </span>
      </li>
    </ul>
  )
}

function ActivityBlock(props: {
  activity: CommentAuthorActivity | undefined
  authorKey: string
  comment: CommentModel
  loading?: boolean
  onViewAll?: () => void
}) {
  const { t } = useI18n()

  if (props.loading && !props.activity) {
    return <SkeletonLines lines={3} />
  }

  if (!props.activity) {
    return <p className="text-sm text-fg-muted">{t('common.noData')}</p>
  }

  const { totalCount, items } = props.activity
  const visible = items.slice(0, 4)

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1">
        {visible.map((item) => (
          <ActivityRow
            current={item.id === props.comment.id}
            item={item}
            key={item.id}
          />
        ))}
        {visible.length === 0 ? (
          <li className="text-sm text-fg-muted">
            {t('comments.sidebar.activityEmpty')}
          </li>
        ) : null}
      </ul>
      {totalCount > visible.length && props.onViewAll ? (
        <button
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
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
  const dotClass = props.current
    ? 'bg-accent'
    : 'border border-border-strong bg-transparent'

  return (
    <li className="flex items-baseline gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'mt-1 inline-block size-2 shrink-0 rounded-full',
          dotClass,
        )}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
        {props.item.refTitle || t('comments.meta.unknown')}
        {' · '}
        {formatCommentDate(props.item.createdAt)}
      </span>
    </li>
  )
}

function ThreatBlock(props: {
  activity: CommentAuthorActivity | undefined
  loading?: boolean
}) {
  const { t } = useI18n()
  if (props.loading && !props.activity) {
    return <SkeletonLines lines={1} />
  }
  if (!props.activity) {
    return <p className="text-sm text-fg-muted">{t('common.noData')}</p>
  }
  const tone =
    props.activity.threatLevel === 'trusted'
      ? 'text-emerald-700 dark:text-emerald-400'
      : props.activity.threatLevel === 'risk'
        ? 'text-red-700 dark:text-red-400'
        : 'text-fg-muted'

  const dotClass =
    props.activity.threatLevel === 'trusted'
      ? 'bg-emerald-500'
      : props.activity.threatLevel === 'risk'
        ? 'bg-red-500'
        : 'bg-fg-subtle'

  return (
    <div className="space-y-1">
      <p
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium',
          tone,
        )}
      >
        <span
          aria-hidden="true"
          className={cn('inline-block size-2 rounded-full', dotClass)}
        />
        {t(`comments.threat.${props.activity.threatLevel}`)}
      </p>
      {props.activity.threatReason ? (
        <p className="text-xs text-fg-subtle">{props.activity.threatReason}</p>
      ) : null}
    </div>
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
