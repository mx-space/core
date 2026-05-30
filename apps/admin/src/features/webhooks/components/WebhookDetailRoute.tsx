import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import type { WebhookModel } from '~/api/webhooks'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { adminQueryKeys } from '~/query/keys'

import { WebhookDetail } from './WebhookDetail'
import { WebhookDispatches } from './WebhookDispatches'
import { useWebhooksRouteContext } from './webhooks-route-context'
import { WebhookDetailEmptyState } from './WebhookStates'

const LIST_PREFIX = adminQueryKeys.webhooks.list()

function extractWebhooks(value: unknown): WebhookModel[] | undefined {
  if (Array.isArray(value)) return value as WebhookModel[]
  return undefined
}

export function WebhookDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useWebhooksRouteContext()

  const webhook = id
    ? findInListCache<WebhookModel>(queryClient, LIST_PREFIX, id, {
        extractItems: extractWebhooks,
      })
    : undefined

  useDocumentTitle(webhook?.url)

  if (!webhook) return <WebhookDetailEmptyState />

  return (
    <section className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
      <WebhookDetail
        onBack={ctx.onBack}
        onDelete={() => ctx.onDelete(webhook)}
        onEdit={() => void ctx.onEdit(webhook)}
        onTest={(event) => ctx.onTest(webhook.id, event)}
        showBack
        webhook={webhook}
      />
      <WebhookDispatches webhookId={webhook.id} />
    </section>
  )
}

export default WebhookDetailRoute
