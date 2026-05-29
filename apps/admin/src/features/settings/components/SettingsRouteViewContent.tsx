import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { getFormSchema } from '~/api/options'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope, useScopeArrowNav } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  settingsQueryKey,
  staticGroupsAfter,
  staticGroupsBefore,
} from '../constants'
import type { SettingsGroupSummary } from '../types/settings'
import { getGroupIcon } from '../utils/settings'
import { SettingsRouteContext } from './settings-route-context'
import { SettingsDetailEmpty } from './SettingsDetailEmpty'

const SETTINGS_NAV_SCOPE_ID = 'settings-nav'

export function SettingsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ section?: string }>()
  const selectedSection = params.section ?? null
  const [searchParams] = useSearchParams()
  const queryGroup = searchParams.get('group')

  const schemaQuery = useQuery({
    queryFn: getFormSchema,
    queryKey: adminQueryKeys.settings.schema(),
  })

  const groups = useMemo<SettingsGroupSummary[]>(() => {
    const systemGroups: SettingsGroupSummary[] =
      schemaQuery.data?.groups.map((group) => ({
        description: group.description,
        icon: getGroupIcon(group.icon),
        key: group.key,
        systemGroup: group,
        title: group.title,
        type: 'system',
      })) ?? []

    return [...staticGroupsBefore, ...systemGroups, ...staticGroupsAfter]
  }, [schemaQuery.data?.groups])

  const activeGroupKey = selectedSection ?? queryGroup ?? null
  const activeGroup =
    (activeGroupKey
      ? groups.find((group) => group.key === activeGroupKey)
      : null) ?? null

  const selectGroup = useCallback(
    (key: string) => {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.delete('group')
      const search = nextSearchParams.toString()
      navigate({
        pathname: `/setting/${encodeURIComponent(key)}`,
        search: search ? `?${search}` : '',
      })
    },
    [navigate, searchParams],
  )

  useScopeArrowNav({
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (el) => {
      const key = el.dataset.id
      if (key) selectGroup(key)
    },
    scopeId: SETTINGS_NAV_SCOPE_ID,
  })

  useEffect(() => {
    if (selectedSection || !queryGroup) return
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('group')
    const search = nextSearchParams.toString()
    navigate(
      {
        pathname: `/setting/${encodeURIComponent(queryGroup)}`,
        search: search ? `?${search}` : '',
      },
      { replace: true },
    )
  }, [navigate, queryGroup, searchParams, selectedSection])

  const closeDetail = useCallback(() => {
    const qs = searchParams.toString()
    navigate(`/setting${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams])

  const invalidateSettings = useCallback(
    () => queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
    [queryClient],
  )

  const routeContextValue = useMemo(
    () => ({
      groups,
      schema: schemaQuery.data,
      onBack: closeDetail,
      onOwnerSaved: invalidateSettings,
    }),
    [closeDetail, groups, invalidateSettings, schemaQuery.data],
  )

  return (
    <SettingsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        emptyDetail={<SettingsDetailEmpty />}
        onDismiss={closeDetail}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={SETTINGS_NAV_SCOPE_ID}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                  {t('settings.shell.title')}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 text-xs text-neutral-400">
                {schemaQuery.isFetching ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : null}
                {t('settings.shell.itemCount', { count: groups.length })}
              </span>
            </div>

            <Scroll className="flex-1" innerClassName="p-2">
              <nav>
                {groups.map((group) => {
                  const Icon = group.icon
                  const selected = activeGroup?.key === group.key
                  const groupTitle = group.titleKey
                    ? t(group.titleKey)
                    : (group.title ?? '')
                  const groupDescription = group.descriptionKey
                    ? t(group.descriptionKey)
                    : (group.description ?? '')

                  return (
                    <button
                      className={cn(
                        'outline-hidden flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)]',
                        selected
                          ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50'
                          : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900/70',
                      )}
                      data-id={group.key}
                      data-scope-item="row"
                      key={group.key}
                      onClick={() => selectGroup(group.key)}
                      type="button"
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded',
                          selected
                            ? 'bg-neutral-200 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50'
                            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {groupTitle}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {groupDescription}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </nav>
            </Scroll>
          </FocusScope>
        }
      />
    </SettingsRouteContext.Provider>
  )
}
