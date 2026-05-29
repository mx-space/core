import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MailX, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getSubscribers,
  getSubscribeStatus,
  unsubscribeBatch,
  updateSubscribeEnabled,
} from '~/api/subscribe'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { pageSize, subscribeQueryKey } from '../constants'
import { StatCard } from './StatCard'
import { SubscribeEmptyState } from './SubscribeEmptyState'
import { SubscriberRow } from './SubscriberRow'
import { SubscriberSkeletonList } from './SubscriberSkeletonList'

export function SubscribeRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isConfirmingBatchDelete, setIsConfirmingBatchDelete] = useState(false)
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = useState(false)

  const statusQuery = useQuery({
    queryFn: getSubscribeStatus,
    queryKey: adminQueryKeys.subscribe.status(),
  })

  const listQuery = useQuery({
    queryFn: () => getSubscribers({ page, size: pageSize }),
    queryKey: adminQueryKeys.subscribe.list({ page, size: pageSize }),
  })

  const subscribers = listQuery.data?.data ?? []
  const pagination = listQuery.data?.pagination
  const totalCount = pagination?.total ?? 0
  const subscribeEnabled = Boolean(statusQuery.data?.enable)

  const filteredSubscribers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return subscribers
    return subscribers.filter((subscriber) =>
      subscriber.email.toLowerCase().includes(query),
    )
  }, [searchQuery, subscribers])

  const isAllSelected =
    filteredSubscribers.length > 0 &&
    filteredSubscribers.every((subscriber) => selectedIds.has(subscriber.id))
  const selectedCount = selectedIds.size

  const invalidateSubscribe = async () => {
    await queryClient.invalidateQueries({ queryKey: subscribeQueryKey })
  }

  const toggleMutation = useMutation({
    mutationFn: updateSubscribeEnabled,
    onSuccess: async () => {
      toast.success(t('subscribe.toggle.success'))
      await invalidateSubscribe()
    },
    onError: () => {
      toast.error(t('subscribe.toggle.failed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: unsubscribeBatch,
    onSuccess: async (result, variables) => {
      toast.success(
        'all' in variables
          ? t('subscribe.toast.deleteAll', { count: result.deletedCount })
          : t('subscribe.toast.delete', { count: result.deletedCount }),
      )
      setSelectedIds(new Set())
      setIsConfirmingBatchDelete(false)
      setIsConfirmingDeleteAll(false)
      await invalidateSubscribe()
    },
    onError: () => {
      toast.error(t('subscribe.toast.deleteFailed'))
    },
  })

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(() =>
      isAllSelected
        ? new Set()
        : new Set(filteredSubscribers.map((subscriber) => subscriber.id)),
    )
  }

  const deleteSelected = () => {
    const selectedEmails = subscribers
      .filter((subscriber) => selectedIds.has(subscriber.id))
      .map((subscriber) => subscriber.email)

    if (selectedEmails.length > 0) {
      deleteMutation.mutate({ emails: selectedEmails })
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <h2 className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            <Mail aria-hidden="true" className="size-4" />
            <span className="truncate">{t('subscribe.title')}</span>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
            {t('subscribe.countSuffix', { count: totalCount })}
          </span>
          <Button
            aria-label={t('subscribe.refreshAria')}
            className="h-8 px-2"
            onClick={() => {
              void invalidateSubscribe()
            }}
            type="button"
            variant="subtle"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 border-b border-neutral-200 p-4 sm:grid-cols-3 dark:border-neutral-800">
        <StatCard
          icon={Users}
          label={t('subscribe.stat.total')}
          value={totalCount}
        />
        <StatCard
          icon={subscribeEnabled ? Mail : MailX}
          label={t('subscribe.stat.feature')}
          tone={subscribeEnabled ? 'success' : 'warning'}
          value={
            subscribeEnabled
              ? t('subscribe.stat.enabled')
              : t('subscribe.stat.disabled')
          }
        />
        <div className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <Switch
            checked={subscribeEnabled}
            disabled={toggleMutation.isPending}
            label={t('subscribe.toggle.label')}
            description={t('subscribe.toggle.description')}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Checkbox
            aria-label={t('subscribe.list.selectAllAria')}
            checked={isAllSelected}
            indeterminate={selectedCount > 0 && !isAllSelected}
            onCheckedChange={toggleSelectAll}
          />
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
            />
            <TextInput
              controlClassName="pl-9"
              onChange={setSearchQuery}
              placeholder={t('subscribe.list.searchPlaceholder')}
              value={searchQuery}
            />
          </div>
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                {t('subscribe.list.selected', { count: selectedCount })}
              </span>
              <Button
                className="h-8 px-2"
                onClick={() => {
                  setSelectedIds(new Set())
                  setIsConfirmingBatchDelete(false)
                  setIsConfirmingDeleteAll(false)
                }}
                type="button"
                variant="subtle"
              >
                {t('subscribe.list.deselectAll')}
              </Button>
              <Button
                className="h-8 px-2 text-red-600 dark:text-red-400"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (isConfirmingBatchDelete) {
                    deleteSelected()
                  } else {
                    setIsConfirmingBatchDelete(true)
                    setIsConfirmingDeleteAll(false)
                  }
                }}
                onMouseLeave={() => setIsConfirmingBatchDelete(false)}
                type="button"
                variant="subtle"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
                {isConfirmingBatchDelete
                  ? t('subscribe.list.confirmBatchDelete')
                  : t('subscribe.list.batchDelete')}
              </Button>
              {isAllSelected && totalCount > 0 ? (
                <Button
                  className="h-8 px-2 text-red-600 dark:text-red-400"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (isConfirmingDeleteAll) {
                      deleteMutation.mutate({ all: true })
                    } else {
                      setIsConfirmingDeleteAll(true)
                      setIsConfirmingBatchDelete(false)
                    }
                  }}
                  onMouseLeave={() => setIsConfirmingDeleteAll(false)}
                  type="button"
                  variant="subtle"
                >
                  {isConfirmingDeleteAll
                    ? t('subscribe.list.confirmDeleteAll')
                    : t('subscribe.list.deleteAll')}
                </Button>
              ) : null}
            </div>
          ) : (
            <span className="text-sm text-neutral-500">
              {t('subscribe.list.totalSuffix', { count: totalCount })}
            </span>
          )}
        </div>

        <Scroll className="flex-1">
          {listQuery.isLoading && subscribers.length === 0 ? (
            <SubscriberSkeletonList />
          ) : filteredSubscribers.length === 0 ? (
            <SubscribeEmptyState hasSearch={Boolean(searchQuery.trim())} />
          ) : (
            filteredSubscribers.map((subscriber) => (
              <SubscriberRow
                key={subscriber.id}
                onDelete={() =>
                  deleteMutation.mutate({ emails: [subscriber.email] })
                }
                onSelect={(checked) => toggleSelect(subscriber.id, checked)}
                selected={selectedIds.has(subscriber.id)}
                subscriber={subscriber}
              />
            ))
          )}
        </Scroll>

        {pagination && pagination.totalPage > 1 ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <Button
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
              variant="subtle"
            >
              {t('common.pagination.previousPage')}
            </Button>
            <span>
              {pagination.currentPage} / {pagination.totalPage}
            </span>
            <Button
              disabled={!pagination.hasNextPage}
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPage, current + 1),
                )
              }
              type="button"
              variant="subtle"
            >
              {t('common.pagination.nextPage')}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
