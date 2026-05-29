import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { WebhookModel } from '~/api/webhooks'
import { deleteWebhook, getWebhooks, testWebhook } from '~/api/webhooks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { webhooksQueryKey } from '../constants'
import { presentWebhookEditor } from './WebhookEditorModal'
import { WebhookList } from './WebhookList'
import { WebhooksRouteContext } from './webhooks-route-context'
import {
  WebhookDetailEmptyState,
  WebhookListEmptyState,
  WebhookListSkeleton,
} from './WebhookStates'

export function WebhooksRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const autoSelectedRef = useRef(false)

  const webhooksQuery = useQuery({
    queryFn: getWebhooks,
    queryKey: adminQueryKeys.webhooks.list(),
  })

  const webhooks = webhooksQuery.data ?? []

  useEffect(() => {
    if (autoSelectedRef.current) return
    if (detailId) {
      autoSelectedRef.current = true
      return
    }
    if (webhooks.length === 0) return
    autoSelectedRef.current = true
    navigate(`/webhooks/${webhooks[0].id}`, { replace: true })
  }, [detailId, navigate, webhooks])

  const invalidateWebhooks = async () => {
    await queryClient.invalidateQueries({ queryKey: webhooksQueryKey })
  }

  const closeDetail = useCallback(() => {
    navigate('/webhooks')
  }, [navigate])

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: async () => {
      toast.success(t('webhooks.toast.deleted'))
      closeDetail()
      await invalidateWebhooks()
    },
    onError: () => {
      toast.error(t('webhooks.toast.deleteFailed'))
    },
  })

  const testMutation = useMutation({
    mutationFn: ({ event, id }: { event: string; id: string }) =>
      testWebhook(id, event),
    onSuccess: () => {
      toast.success(t('webhooks.toast.tested'))
    },
    onError: () => {
      toast.error(t('webhooks.toast.testFailed'))
    },
  })

  const openEditor = useCallback(
    async (webhook: WebhookModel | null) => {
      const saved = await presentWebhookEditor(webhook)
      if (saved) {
        await invalidateWebhooks()
        navigate(`/webhooks/${saved.id}`)
      }
    },
    [navigate],
  )

  const ctxValue = useMemo(
    () => ({
      onBack: closeDetail,
      onDelete: (webhook: WebhookModel) => deleteMutation.mutate(webhook.id),
      onEdit: (webhook: WebhookModel) => openEditor(webhook),
      onTest: (id: string, event: string) => testMutation.mutate({ event, id }),
    }),
    [closeDetail, deleteMutation, openEditor, testMutation],
  )

  return (
    <WebhooksRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        emptyDetail={<WebhookDetailEmptyState />}
        list={
          <section className="flex h-full min-h-0 flex-col">
            <div
              className={cn(
                'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <div>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Webhooks
                  </span>
                  <span className="ml-2 text-xs text-neutral-400">
                    {t('webhooks.enabledCount', {
                      enabled: webhooks.filter((webhook) => webhook.enabled)
                        .length,
                      total: webhooks.length,
                    })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  aria-label={t('webhooks.refreshAria')}
                  className="h-8 px-2"
                  onClick={() => {
                    void invalidateWebhooks()
                  }}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" />
                </Button>
                <Button
                  className="h-8 px-2"
                  onClick={() => void openEditor(null)}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  {t('webhooks.add')}
                </Button>
              </div>
            </div>

            <Scroll className="flex-1">
              {webhooksQuery.isLoading && webhooks.length === 0 ? (
                <WebhookListSkeleton />
              ) : webhooks.length === 0 ? (
                <WebhookListEmptyState onCreate={() => void openEditor(null)} />
              ) : (
                <WebhookList
                  onSelect={(webhook) => {
                    navigate(`/webhooks/${webhook.id}`)
                  }}
                  selectedId={detailId}
                  webhooks={webhooks}
                />
              )}
            </Scroll>
          </section>
        }
      />
    </WebhooksRouteContext.Provider>
  )
}
