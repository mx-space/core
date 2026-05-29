import { ArrowLeft, Loader2, Save, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { AccountSettings } from './account/AccountSettings'
import { MetaPresetSettings } from './meta/MetaPresetSettings'
import { OwnerSettings } from './OwnerSettings'
import { useSettingsRouteContext } from './settings-route-context'
import type { SettingsDirtyAction } from './SettingsActionBar'
import { SettingsActionBarContext } from './SettingsActionBar'
import { SettingsDetailEmpty } from './SettingsDetailEmpty'
import { SystemSettings } from './SystemSettings'

export function SettingsDetailRoute() {
  const { t } = useI18n()
  const { section } = useParams<{ section?: string }>()
  const ctx = useSettingsRouteContext()
  const [dirtyAction, setDirtyAction] = useState<SettingsDirtyAction | null>(
    null,
  )

  const activeGroup = ctx.groups.find((group) => group.key === section)

  if (!activeGroup) return <SettingsDetailEmpty />

  const activeTitle = activeGroup.titleKey
    ? t(activeGroup.titleKey)
    : (activeGroup.title ?? '')
  const activeDescription = activeGroup.descriptionKey
    ? t(activeGroup.descriptionKey)
    : (activeGroup.description ?? '')

  return (
    <SettingsActionBarContext.Provider value={setDirtyAction}>
      <main className="flex h-full min-h-0 min-w-0 flex-col">
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 dark:border-neutral-800',
            APP_SHELL_HEADER_HEIGHT_CLASS,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <MobileHeaderAffordance />
            <Button
              aria-label={t('settings.owner.mobileBackAria')}
              className="h-8 px-2 lg:hidden"
              onClick={ctx.onBack}
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
            ) : null}
          </div>
        </div>

        <Scroll className="flex-1" innerClassName="p-4">
          {activeGroup.type === 'user' ? (
            <OwnerSettings
              onSaved={async () => {
                await ctx.onOwnerSaved()
              }}
            />
          ) : null}
          {activeGroup.type === 'account' ? <AccountSettings /> : null}
          {activeGroup.type === 'meta-preset' ? <MetaPresetSettings /> : null}
          {activeGroup.type === 'system' && activeGroup.systemGroup ? (
            <SystemSettings
              activeGroup={activeGroup.systemGroup}
              schema={ctx.schema}
            />
          ) : null}
        </Scroll>
      </main>
    </SettingsActionBarContext.Provider>
  )
}

export default SettingsDetailRoute
