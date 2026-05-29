import { createContext, useContext } from 'react'

import type { WebhookModel } from '~/api/webhooks'

export interface WebhooksRouteContextValue {
  onBack: () => void
  onDelete: (webhook: WebhookModel) => void
  onEdit: (webhook: WebhookModel) => Promise<void> | void
  onTest: (id: string, event: string) => void
}

export const WebhooksRouteContext =
  createContext<WebhooksRouteContextValue | null>(null)

export function useWebhooksRouteContext(): WebhooksRouteContextValue {
  const ctx = useContext(WebhooksRouteContext)
  if (!ctx) {
    throw new Error(
      'useWebhooksRouteContext must be used inside <WebhooksRouteContext.Provider>',
    )
  }
  return ctx
}
