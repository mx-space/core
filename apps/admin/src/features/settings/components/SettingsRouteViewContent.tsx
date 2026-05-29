import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import type { SettingsGroupSummary } from '../types/settings'
import type { SettingsDirtyAction } from './SettingsActionBar'

import { getFormSchema } from '~/api/options'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { FocusScope, useScopeArrowNav } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  settingsQueryKey,
  staticGroupsAfter,
  staticGroupsBefore,
} from '../constants'
import { getGroupIcon } from '../utils/settings'
import { AccountSettings } from './account/AccountSettings'
import { MetaPresetSettings } from './meta/MetaPresetSettings'
import { OwnerSettings } from './OwnerSettings'
import { SettingsActionBarContext } from './SettingsActionBar'
import { SystemSettings } from './SystemSettings'

const SETTINGS_NAV_SCOPE_ID = 'settings-nav'

export function SettingsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { tab } = useParams()
  const [searchParams] = useSearchParams()
  const queryGroup = searchParams.get('group')
  const selectedGroup = tab || queryGroup || 'user'
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(() =>
    Boolean(tab || queryGroup),
  )
  const [dirtyAction, setDirtyAction] = useState<SettingsDirtyAction | null>(
    null,
  )

  const schemaQuery = useQuery({
    queryFn: getFormSchema,
    queryKey: [...settingsQueryKey, 'schema'],
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

  const activeGroup =
    groups.find((group) => group.key === selectedGroup) ?? groups[0]

  const activeTitle = activeGroup.titleKey
    ? t(activeGroup.titleKey)
    : (activeGroup.title ?? '')
  const activeDescription = activeGroup.descriptionKey
    ? t(activeGroup.descriptionKey)
    : (activeGroup.description ?? '')

  const selectGroup = (key: string) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('group')
    const search = nextSearchParams.toString()

    navigate({
      pathname: `/setting/${encodeURIComponent(key)}`,
      search: search ? `?${search}` : '',
    })
    setShowDetailOnMobile(true)
  }

  useScopeArrowNav({
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (el) => {
      const key = el.dataset.id
      if (key) selectGroup(key)
    },
    scopeId: SETTINGS_NAV_SCOPE_ID,
  })

  useEffect(() => {
    if (tab || !queryGroup) return

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
  }, [navigate, queryGroup, searchParams, tab])

  return (
    <SettingsActionBarContext.Provider value={setDirtyAction}>
      <MasterDetailLayout
        showDetailOnMobile={showDetailOnMobile}
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
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                  {t('settings.shell.title')}
                </h2>
              </div>
              <span className="text-xs text-neutral-400">
                {t('settings.shell.itemCount', { count: groups.length })}
              </span>
            </div>

            <Scroll className="flex-1" innerClassName="p-2">
              <nav>
                {groups.map((group) => {
                  const Icon = group.icon
                  const selected = activeGroup.key === group.key
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
        detail={
          <main className="flex h-full min-h-0 min-w-0 flex-col">
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  aria-label={t('settings.owner.mobileBackAria')}
                  className="h-8 px-2 lg:hidden"
                  onClick={() => setShowDetailOnMobile(false)}
                  type="button"
                  variant="subtle"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </Button>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {activeTitle}
                  </h1>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {activeDescription}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {dirtyAction ? (
                  <>
                    <span className="inline-flex items-center gap-2 text-xs text-neutral-500">
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-amber-500"
                      />
                      {t('settings.common.savingDirty', {
                        count: dirtyAction.count,
                      })}
                    </span>
                    <Button
                      className="h-8 px-2"
                      disabled={dirtyAction.saving}
                      onClick={dirtyAction.onDiscard}
                      type="button"
                      variant="subtle"
                    >
                      <Undo2 aria-hidden="true" className="size-4" />
                      {t('common.cancel')}
                    </Button>
                    <Button
                      className="h-8 px-2"
                      disabled={dirtyAction.saving}
                      onClick={dirtyAction.onSaveAll}
                      type="button"
                    >
                      {dirtyAction.saving ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <Save aria-hidden="true" className="size-4" />
                      )}
                      {t('settings.common.section.saveAll')}
                    </Button>
                  </>
                ) : schemaQuery.isFetching ? (
                  <span className="inline-flex items-center gap-2 text-xs text-neutral-500">
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    {t('settings.common.section.syncSchema')}
                  </span>
                ) : null}
              </div>
            </div>

            <Scroll className="flex-1" innerClassName="p-4">
              {activeGroup.type === 'user' ? (
                <OwnerSettings
                  onSaved={() =>
                    queryClient.invalidateQueries({
                      queryKey: settingsQueryKey,
                    })
                  }
                />
              ) : null}
              {activeGroup.type === 'account' ? <AccountSettings /> : null}
              {activeGroup.type === 'meta-preset' ? (
                <MetaPresetSettings />
              ) : null}
              {activeGroup.type === 'system' && activeGroup.systemGroup ? (
                <SystemSettings
                  activeGroup={activeGroup.systemGroup}
                  schema={schemaQuery.data}
                />
              ) : null}
            </Scroll>
          </main>
        }
      />
    </SettingsActionBarContext.Provider>
  )
}
