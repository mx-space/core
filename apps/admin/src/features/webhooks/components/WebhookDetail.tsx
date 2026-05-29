import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Pencil,
  Play,
  Shield,
  Trash2,
  Webhook,
} from 'lucide-react'
import { useState } from 'react'
import type { WebhookModel } from '~/api/webhooks'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { getScopeText } from '../utils/webhooks'
import { EventBadge, InfoCard, StatusDot } from './WebhookPrimitives'

export function WebhookDetail(props: {
  onBack: () => void
  onDelete: () => void
  onEdit: () => void
  onTest: (event: string) => void
  showBack: boolean
  webhook: WebhookModel
}) {
  const { t } = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const targetUrl = props.webhook.payloadUrl || props.webhook.url

  return (
    <section className="flex min-h-0 flex-col border-b border-neutral-200 dark:border-neutral-800">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {props.showBack ? (
            <Button
              aria-label={t('webhooks.detail.backAria')}
              className="h-8 px-2 lg:hidden"
              onClick={props.onBack}
              type="button"
              variant="subtle"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
          <h2 className="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {t('webhooks.detail.title')}
          </h2>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            className="h-8 px-2"
            onClick={props.onEdit}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            {t('webhooks.detail.edit')}
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
              ? t('webhooks.detail.confirm')
              : t('webhooks.detail.delete')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                <Webhook
                  aria-hidden="true"
                  className="size-7 text-neutral-500 dark:text-neutral-400"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-white dark:border-neutral-950 dark:bg-neutral-950">
                <StatusDot enabled={props.webhook.enabled} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {targetUrl}
                </h2>
                {targetUrl ? (
                  <a
                    className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    href={targetUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {props.webhook.enabled
                    ? t('webhooks.detail.enabled')
                    : t('webhooks.detail.disabled')}
                </span>
                <span>{getScopeText(props.webhook.scope, t)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard
              icon={Globe}
              label={t('webhooks.detail.scope')}
              value={getScopeText(props.webhook.scope, t)}
            />
            <InfoCard
              icon={Shield}
              label={t('webhooks.detail.secret')}
              value={
                props.webhook.secret
                  ? t('webhooks.detail.secretConfigured')
                  : t('webhooks.detail.secretNone')
              }
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('webhooks.detail.eventsCount', {
                count: props.webhook.events.length,
              })}
            </h3>
            <div className="flex flex-wrap gap-2">
              {props.webhook.events.map((event) => (
                <EventBadge event={event} key={event} />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('webhooks.detail.testTitle')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {props.webhook.events.map((event) => (
                <Button
                  className="h-8 px-2"
                  key={event}
                  onClick={() => props.onTest(event)}
                  type="button"
                  variant="subtle"
                >
                  <Play aria-hidden="true" className="size-3.5" />
                  {event}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Scroll>
    </section>
  )
}
