import { useMutation, useQuery } from '@tanstack/react-query'
import { Globe, Shield } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { resetAllCollections } from '~/data/resource/collection'
import { IpInfoPopover } from '~/features/_shared/components/ip-info-popover'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { authClient } from '~/utils/authjs/auth'
import { cn } from '~/utils/cn'

import type { AccountSession } from '../../types/settings'
import { listSessions } from '../../utils/account-sessions'
import { formatDateTime, getErrorMessage } from '../../utils/settings'
import { SettingsSection } from '../SettingsPrimitives'

export function SessionSection() {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const sessionsQuery = useQuery({
    queryFn: () => listSessions(t),
    queryKey: adminQueryKeys.settings.sessions(),
  })

  const deleteMutation = useMutation({
    mutationFn: async (session: AccountSession) => {
      if (session.current) {
        const result = await authClient.signOut()
        if (result.error)
          throw new Error(
            result.error.message || t('settings.session.error.revokeFailed'),
          )
        resetAllCollections()
      } else {
        const result = await authClient.revokeSession({ token: session.token })
        if (result.error)
          throw new Error(
            result.error.message || t('settings.session.error.kickFailed'),
          )
      }
    },
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.session.error.operationFailed')),
      ),
    onSuccess: async (_, session) => {
      toast.success(
        session.current
          ? t('settings.session.success.signOut')
          : t('settings.session.success.kicked'),
      )
      if (session.current) window.location.reload()
      await sessionsQuery.refetch()
    },
  })

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeOtherSessions()
      if (result.error)
        throw new Error(
          result.error.message || t('settings.session.error.kickFailed'),
        )
    },
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.session.error.kickFailed')),
      ),
    onSuccess: async () => {
      toast.success(t('settings.session.success.others'))
      await sessionsQuery.refetch()
    },
  })
  const sessions = sessionsQuery.data ?? []
  const visibleSessions = expanded ? sessions : sessions.slice(0, 5)
  const hiddenSessionCount = Math.max(
    sessions.length - visibleSessions.length,
    0,
  )

  return (
    <SettingsSection
      actions={
        sessions.length > 1 ? (
          <Button
            disabled={revokeOthersMutation.isPending}
            onClick={() => {
              if (window.confirm(t('settings.session.confirm.revokeOthers'))) {
                revokeOthersMutation.mutate()
              }
            }}
            type="button"
            variant="subtle"
          >
            {t('settings.session.action.revokeOthers')}
          </Button>
        ) : null
      }
      description={t('settings.session.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <Shield aria-hidden="true" className="size-4" />
          {t('settings.session.title')}
        </span>
      }
    >
      <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
        {sessionsQuery.isLoading ? (
          <div className="py-3 text-sm text-neutral-500">
            {t('settings.common.loading')}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-3 text-sm text-neutral-500">
            {t('settings.session.empty')}
          </div>
        ) : (
          <>
            {visibleSessions.map((session) => (
              <div className="py-3" key={session.token}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs',
                          session.current
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900',
                        )}
                      >
                        {session.current
                          ? t('settings.session.badge.current')
                          : t('settings.session.badge.other')}
                      </span>
                      {session.ip ? (
                        <IpInfoPopover
                          className="inline-flex min-w-0 items-center gap-1 text-xs text-neutral-500 hover:underline dark:text-neutral-400"
                          ip={session.ip}
                          trigger={
                            <>
                              <Globe
                                aria-hidden="true"
                                className="size-3 shrink-0 text-neutral-400"
                              />
                              <span>{session.ip}</span>
                            </>
                          }
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 truncate font-mono text-xs text-neutral-600 dark:text-neutral-300">
                      {session.ua || 'Unknown user agent'}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {session.current
                        ? t('settings.session.activeAt', {
                            time: formatDateTime(session.lastActiveAt),
                          })
                        : t('settings.session.loginAt', {
                            time: formatDateTime(session.lastActiveAt),
                          })}
                    </p>
                  </div>
                  <Button
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          session.current
                            ? t('settings.session.confirm.signOut')
                            : t('settings.session.confirm.kick'),
                        )
                      ) {
                        deleteMutation.mutate(session)
                      }
                    }}
                    type="button"
                    variant="subtle"
                  >
                    {session.current
                      ? t('settings.session.button.signOut')
                      : t('settings.session.button.kick')}
                  </Button>
                </div>
              </div>
            ))}
            {sessions.length > 5 ? (
              <div className="py-3">
                <button
                  className="flex w-full items-center justify-center text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
                  onClick={() => setExpanded((current) => !current)}
                  type="button"
                >
                  {expanded
                    ? t('settings.session.action.viewMoreCollapse')
                    : t('settings.session.action.viewMore', {
                        count: hiddenSessionCount,
                      })}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </SettingsSection>
  )
}
