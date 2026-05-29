import type { WebhookModel } from '~/api/webhooks'

import { useI18n } from '~/i18n'

import { getScopeText } from '../utils/webhooks'
import { StatusDot } from './WebhookPrimitives'

export function WebhookList(props: {
  onSelect: (webhook: WebhookModel) => void
  selectedId: string | null
  webhooks: WebhookModel[]
}) {
  const { t } = useI18n()
  return (
    <>
      {props.webhooks.map((webhook) => (
        <button
          className={[
            'flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-900',
            props.selectedId === webhook.id
              ? 'bg-neutral-100 dark:bg-neutral-900'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
          ].join(' ')}
          key={webhook.id}
          onClick={() => props.onSelect(webhook)}
          type="button"
        >
          <StatusDot enabled={webhook.enabled} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {webhook.payloadUrl || webhook.url}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
              <span>
                {t('webhooks.list.eventsSuffix', {
                  count: webhook.events.length,
                })}
              </span>
              <span>·</span>
              <span>{getScopeText(webhook.scope, t)}</span>
            </div>
          </div>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {webhook.enabled
              ? t('webhooks.list.enabled')
              : t('webhooks.list.disabled')}
          </span>
        </button>
      ))}
    </>
  )
}
