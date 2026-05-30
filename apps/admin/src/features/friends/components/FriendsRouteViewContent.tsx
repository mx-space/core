import { Plus, RefreshCcw, SearchCheck, UserRound } from 'lucide-react'
import { useState } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { LinkModel } from '~/models/link'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { useFriendMutations } from '../hooks/use-friend-mutations'
import { useFriendsList } from '../hooks/use-friends-list'
import type { HealthMap } from '../types/friends'
import { presentAuditReason } from './AuditReasonModal'
import { presentFriendEditor } from './FriendEditorModal'
import { FriendRow } from './FriendRow'
import { FriendsEmptyRow, FriendsSkeletonRows } from './FriendsPrimitives'
import { FriendsTabBar } from './FriendsTabBar'

export function FriendsRouteViewContent() {
  const { t } = useI18n()
  const [health, setHealth] = useState<HealthMap>({})
  const {
    counts,
    links,
    linksQuery,
    page,
    pagination,
    setPage,
    setState,
    state,
  } = useFriendsList()

  const {
    auditPassMutation,
    deleteMutation,
    healthMutation,
    invalidateFriends,
    migrateMutation,
  } = useFriendMutations({
    onHealthResult: (result) => {
      setHealth(
        Object.fromEntries(
          Object.entries(result).map(([key, value]) => [
            key.toLowerCase(),
            value,
          ]),
        ),
      )
    },
  })

  const openAuditReason = async (link: LinkModel) => {
    const ok = await presentAuditReason(link)
    if (ok) {
      await invalidateFriends()
    }
  }

  const openEditor = async (link: LinkModel | null) => {
    const ok = await presentFriendEditor(link)
    if (ok) {
      await invalidateFriends()
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
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
        <FriendsTabBar counts={counts} onChange={setState} value={state} />
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
