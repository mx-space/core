import { ChevronRight, RefreshCw } from 'lucide-react'
import type { WebhookEventRecord } from '~/api/webhooks'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { formatDateTime } from '../utils/webhooks'
import { EventBadge, JsonBlock, StatusDot } from './WebhookPrimitives'

export function DispatchRow(props: {
  dispatch: WebhookEventRecord
  expanded: boolean
  onRedispatch: () => void
  onToggle: () => void
}) {
  const { t } = useI18n()
  return (
    <div>
      <button
        className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
        onClick={props.onToggle}
        type="button"
      >
        <ChevronRight
          aria-hidden="true"
          className={[
            'size-3.5 shrink-0 text-neutral-400 transition-transform',
            props.expanded ? 'rotate-90' : '',
          ].join(' ')}
        />
        <StatusDot enabled={props.dispatch.success} />
        <div className="min-w-0 flex-1">
          <EventBadge event={props.dispatch.event} />
        </div>
        <span
          className={[
            'rounded px-1.5 py-0.5 text-xs',
            props.dispatch.success
              ? 'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
          ].join(' ')}
        >
          {props.dispatch.status}
        </span>
        <time
          className="shrink-0 text-xs text-neutral-400"
          dateTime={props.dispatch.timestamp}
        >
          {formatDateTime(props.dispatch.timestamp)}
        </time>
      </button>
      {props.expanded ? (
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-900 dark:bg-neutral-900/50">
          <div className="mb-3 flex justify-end">
            <Button
              className="h-8 px-2"
              onClick={props.onRedispatch}
              type="button"
              variant="subtle"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              {t('webhooks.dispatch.redispatch')}
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <JsonBlock content={props.dispatch.payload} label="Payload" />
            <JsonBlock content={props.dispatch.response} label="Response" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
