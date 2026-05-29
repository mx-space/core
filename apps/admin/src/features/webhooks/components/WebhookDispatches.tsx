import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { getWebhookDispatches, redispatchWebhook } from '~/api/webhooks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { dispatchPageSize } from '../constants'
import { DispatchRow } from './DispatchRow'

export function WebhookDispatches(props: { webhookId: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const dispatchesQuery = useQuery({
    queryFn: () =>
      getWebhookDispatches(props.webhookId, {
        page,
        size: dispatchPageSize,
      }),
    queryKey: adminQueryKeys.webhooks.dispatches({
      page,
      size: dispatchPageSize,
      webhookId: props.webhookId,
    }),
  })

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [props.webhookId])

  const redispatchMutation = useMutation({
    mutationFn: (eventId: string) =>
      redispatchWebhook(props.webhookId, eventId),
    onSuccess: async () => {
      toast.success(t('webhooks.toast.redispatched'))
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.webhooks.dispatchesRoot(props.webhookId),
      })
    },
    onError: () => {
      toast.error(t('webhooks.toast.redispatchFailed'))
    },
  })

  const dispatches = dispatchesQuery.data?.data ?? []
  const pagination = dispatchesQuery.data?.pagination

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-t border-neutral-200 dark:border-neutral-800">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {t('webhooks.dispatch.title')}
        </h2>
        {pagination ? (
          <span className="text-xs text-neutral-400">
            {t('webhooks.dispatch.totalSuffix', { count: pagination.total })}
          </span>
        ) : null}
      </div>

      <Scroll className="flex-1">
        {dispatchesQuery.isLoading && dispatches.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-950 dark:border-neutral-700 dark:border-t-neutral-100" />
          </div>
        ) : dispatches.length === 0 ? (
          <div className="py-20 text-center text-sm text-neutral-400">
            {t('webhooks.dispatch.empty')}
          </div>
        ) : (
          dispatches.map((dispatch) => (
            <DispatchRow
              dispatch={dispatch}
              expanded={expandedId === dispatch.id}
              key={dispatch.id}
              onRedispatch={() => redispatchMutation.mutate(dispatch.id)}
              onToggle={() =>
                setExpandedId((current) =>
                  current === dispatch.id ? null : dispatch.id,
                )
              }
            />
          ))
        )}
      </Scroll>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 border-t border-neutral-200 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
            variant="subtle"
          >
            {t('common.pagination.previousPage')}
          </Button>
          <span>
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            disabled={page >= pagination.totalPages}
            onClick={() =>
              setPage((current) => Math.min(pagination.totalPages, current + 1))
            }
            type="button"
            variant="subtle"
          >
            {t('common.pagination.nextPage')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
