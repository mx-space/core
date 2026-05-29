import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCcw, SearchCheck, UserRound } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { LinkModel } from '~/models/link'
import type { HealthMap } from '../types/friends'

import {
  auditPassLink,
  checkLinksHealth,
  deleteLink,
  getLinks,
  getLinkStateCount,
  migrateLinkAvatars,
} from '~/api/links'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { friendsPageSize, friendsQueryKey } from '../constants'
import { normalizeState, readPage } from '../utils/friends'
import { presentAuditReason } from './AuditReasonModal'
import { presentFriendEditor } from './FriendEditorModal'
import { FriendRow } from './FriendRow'
import { FriendsEmptyRow, FriendsSkeletonRows } from './FriendsPrimitives'
import { FriendsTabBar } from './FriendsTabBar'

export function FriendsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [state, setState] = useState(() =>
    normalizeState(searchParams.get('state')),
  )
  const [page, setPage] = useState(() => readPage(searchParams.get('page')))
  const [health, setHealth] = useState<HealthMap>({})

  const linksQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getLinks({ page, size: friendsPageSize, state }),
    queryKey: [...friendsQueryKey, 'list', state, page, friendsPageSize],
  })

  const countsQuery = useQuery({
    queryFn: getLinkStateCount,
    queryKey: [...friendsQueryKey, 'state-count'],
  })

  useLayoutEffect(() => {
    const nextState = normalizeState(searchParams.get('state'))
    const nextPage = readPage(searchParams.get('page'))

    setState((value) => (value === nextState ? value : nextState))
    setPage((value) => (value === nextPage ? value : nextPage))
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams()
    next.set('state', String(state))
    if (page > 1) next.set('page', String(page))
    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
  }, [page, searchParamsKey, setSearchParams, state])

  const invalidateLinks = async () => {
    await queryClient.invalidateQueries({ queryKey: friendsQueryKey })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteLink,
    onSuccess: async () => {
      toast.success(t('friends.toast.deleted'))
      await invalidateLinks()
    },
  })

  const auditPassMutation = useMutation({
    mutationFn: auditPassLink,
    onSuccess: async () => {
      toast.success(t('friends.toast.auditPass'))
      await invalidateLinks()
    },
  })

  const openAuditReason = async (link: LinkModel) => {
    const ok = await presentAuditReason(link)
    if (ok) {
      await invalidateLinks()
    }
  }

  const healthMutation = useMutation({
    mutationFn: checkLinksHealth,
    onSuccess: (result) => {
      setHealth(
        Object.fromEntries(
          Object.entries(result).map(([key, value]) => [
            key.toLowerCase(),
            value,
          ]),
        ),
      )
      toast.success(t('friends.toast.healthDone'))
    },
  })

  const migrateMutation = useMutation({
    mutationFn: migrateLinkAvatars,
    onSuccess: async () => {
      toast.success(t('friends.toast.migrated'))
      await invalidateLinks()
    },
  })

  const links = linksQuery.data?.data ?? []
  const pagination = linksQuery.data?.pagination
  const counts = countsQuery.data

  const openEditor = async (link: LinkModel | null) => {
    const ok = await presentFriendEditor(link)
    if (ok) {
      await invalidateLinks()
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
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            <UserRound aria-hidden="true" className="size-4" />
            {t('friends.title')}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
            {pagination
              ? t('friends.countLabel', { count: pagination.total })
              : t('common.loading')}
          </span>
          <Button
            onClick={() => void openEditor(null)}
            type="button"
            variant="subtle"
          >
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t('friends.list.create')}</span>
          </Button>
          <Button
            aria-label={t('friends.actions.checkHealthAria')}
            disabled={healthMutation.isPending}
            onClick={() => healthMutation.mutate()}
            type="button"
            variant="subtle"
          >
            <SearchCheck aria-hidden="true" className="size-4" />
            <span className="hidden lg:inline">
              {t('friends.actions.checkHealthLabel')}
            </span>
          </Button>
          <Button
            aria-label={t('friends.actions.migrateAvatarsAria')}
            disabled={migrateMutation.isPending}
            onClick={() => migrateMutation.mutate()}
            type="button"
            variant="subtle"
          >
            <RefreshCcw aria-hidden="true" className="size-4" />
            <span className="hidden lg:inline">
              {t('friends.actions.migrateAvatarsLabel')}
            </span>
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <FriendsTabBar
          counts={counts}
          onChange={(nextState) => {
            setState(nextState)
            setPage(1)
          }}
          value={state}
        />
      </div>

      <Scroll className="flex-1" orientation="both">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">
                {t('friends.table.name')}
              </th>
              <th className="px-4 py-3 font-medium">
                {t('friends.table.description')}
              </th>
              <th className="px-4 py-3 font-medium">
                {t('friends.table.url')}
              </th>
              <th className="px-4 py-3 font-medium">
                {t('friends.table.type')}
              </th>
              <th className="px-4 py-3 font-medium">
                {t('friends.table.email')}
              </th>
              <th className="px-4 py-3 font-medium">
                {t('friends.table.createdAt')}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t('friends.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {linksQuery.isLoading && links.length === 0 ? (
              <FriendsSkeletonRows />
            ) : links.length === 0 ? (
              <FriendsEmptyRow />
            ) : (
              links.map((link) => (
                <FriendRow
                  health={health[link.id]}
                  key={link.id}
                  link={link}
                  onAuditPass={() => auditPassMutation.mutate(link.id)}
                  onAuditReason={() => void openAuditReason(link)}
                  onDelete={() => deleteMutation.mutate(link.id)}
                  onEdit={() => void openEditor(link)}
                />
              ))
            )}
          </tbody>
        </table>
      </Scroll>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
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
