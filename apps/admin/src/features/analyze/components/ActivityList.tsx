import { Heart, Timer } from 'lucide-react'

import type { ActivityItem } from '~/api/activity'
import { ActivityType } from '~/api/activity'
import { useI18n } from '~/i18n'
import type { ActivityReadDurationType } from '~/models/activity'
import { relativeTimeFromNow } from '~/utils/time'

import { formatDuration } from '../utils/analyze'
import { IpInfoButton } from './IpInfoButton'
import { ReferenceButton } from './ReferenceButton'

export function ActivityList(props: {
  items: Array<ActivityItem | ActivityReadDurationType>
  refObjects: Map<string, { id: string; title?: string }>
  type: ActivityType
}) {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {props.items.map((item) =>
        props.type === ActivityType.ReadDuration ? (
          <ReadDurationActivityRow
            item={item as ActivityReadDurationType}
            key={item.id}
            refObject={
              'refId' in item && item.refId
                ? props.refObjects.get(item.refId)
                : undefined
            }
          />
        ) : (
          <LikeActivityRow item={item as ActivityItem} key={item.id} />
        ),
      )}
    </div>
  )
}

function LikeActivityRow(props: { item: ActivityItem }) {
  const { t } = useI18n()
  const refId = props.item.ref?.id ?? props.item.payload.id
  const title = props.item.ref?.title ?? t('analyze.likedContent.deleted')

  return (
    <article className="flex items-center gap-3 px-4 py-2.5">
      <Heart
        aria-label={t('analyze.activity.like')}
        className="size-3.5 shrink-0 text-red-500"
      />
      <div className="min-w-0 flex-1">
        <ReferenceButton id={refId} title={title} />
      </div>
      {props.item.payload.ip ? (
        <span className="phone:hidden shrink-0">
          <IpInfoButton ip={props.item.payload.ip} />
        </span>
      ) : null}
      <time
        className="shrink-0 text-xs text-fg-subtle"
        dateTime={props.item.createdAt}
      >
        {relativeTimeFromNow(props.item.createdAt)}
      </time>
    </article>
  )
}

function ReadDurationActivityRow(props: {
  item: ActivityReadDurationType
  refObject?: { id: string; title?: string }
}) {
  const { t } = useI18n()
  const durationMs =
    props.item.payload.operationTime - props.item.payload.connectedAt
  const title = props.refObject?.title ?? t('analyze.activity.unknownContent')
  const visitor = props.item.payload.displayName || props.item.payload.identity

  return (
    <article className="flex items-center gap-3 px-4 py-2.5">
      <Timer
        aria-label={t('analyze.activity.read')}
        className="size-3.5 shrink-0 text-blue-500"
      />
      <div className="min-w-0 flex-1">
        <ReferenceButton id={props.refObject?.id} title={title} />
      </div>
      {visitor ? (
        <span className="phone:hidden max-w-32 shrink-0 truncate text-xs text-fg-muted">
          {visitor}
        </span>
      ) : null}
      <span
        className="shrink-0 text-xs font-medium tabular-nums text-fg"
        title={
          props.item.payload.position > 0
            ? t('analyze.activity.position', {
                value: props.item.payload.position,
              })
            : undefined
        }
      >
        {formatDuration(durationMs, t)}
      </span>
      <span className="phone:hidden shrink-0">
        <IpInfoButton ip={props.item.payload.ip} />
      </span>
      <time
        className="shrink-0 text-xs text-fg-subtle"
        dateTime={props.item.createdAt}
      >
        {relativeTimeFromNow(props.item.createdAt)}
      </time>
    </article>
  )
}
