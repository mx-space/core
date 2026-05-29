import { Heart, Timer } from 'lucide-react'
import type { ActivityItem } from '~/api/activity'
import type { ActivityReadDurationType } from '~/models/activity'

import { ActivityType } from '~/api/activity'
import { useI18n } from '~/i18n'
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
    <article className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <Heart aria-hidden="true" className="size-3.5" />
          {t('analyze.activity.like')}
        </span>
        <time
          className="text-xs text-neutral-400"
          dateTime={props.item.createdAt}
        >
          {relativeTimeFromNow(props.item.createdAt)}
        </time>
      </div>
      <div className="mt-3">
        <ReferenceButton id={refId} title={title} />
      </div>
      {props.item.payload.ip ? (
        <div className="mt-2">
          <IpInfoButton ip={props.item.payload.ip} />
        </div>
      ) : null}
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
  const durationPercent = Math.min(Math.max(durationMs / 3_600_000, 0), 1) * 100
  const title = props.refObject?.title ?? t('analyze.activity.unknownContent')

  return (
    <article className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Timer aria-hidden="true" className="size-3.5" />
            {t('analyze.activity.read')}
          </span>
          {props.item.payload.displayName || props.item.payload.identity ? (
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {props.item.payload.displayName || props.item.payload.identity}
            </span>
          ) : null}
        </div>
        <time
          className="shrink-0 text-xs text-neutral-400"
          dateTime={props.item.createdAt}
        >
          {relativeTimeFromNow(props.item.createdAt)}
        </time>
      </div>

      <div className="mt-3">
        <ReferenceButton id={props.refObject?.id} title={title} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">
            {t('analyze.activity.readDuration')}
          </span>
          <span className="font-medium text-neutral-700 dark:text-neutral-200">
            {formatDuration(durationMs, t)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
          <div
            className="h-full rounded bg-neutral-950 dark:bg-neutral-50"
            style={{ width: `${durationPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <IpInfoButton ip={props.item.payload.ip} />
        {props.item.payload.position > 0 ? (
          <span>
            {t('analyze.activity.position', {
              value: props.item.payload.position,
            })}
          </span>
        ) : null}
      </div>
    </article>
  )
}
