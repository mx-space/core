import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { checkLogged } from '~/api/auth'
import { useI18n } from '~/i18n'
import { AdminShell } from '~/shell'
import { SocketBridge } from '~/socket/SocketBridge'
import { KeyboardShortcutsProvider } from '~/ui/keyboard-shortcut-overlay'

export function ProtectedLayout() {
  const location = useLocation()
  const { t } = useI18n()
  const loggedQuery = useQuery({
    queryFn: checkLogged,
    queryKey: ['auth', 'check-logged'],
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
  const from = `${location.pathname}${location.search}`

  if (loggedQuery.isLoading) {
    return (
      <main className="flex h-screen items-center justify-center bg-white text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
        {t('app.loading.auth')}
      </main>
    )
  }

  if (!loggedQuery.data?.ok) {
    return (
      <Navigate
        replace
        to={`/login?from=${encodeURIComponent(from || '/dashboard')}`}
      />
    )
  }

  return (
    <KeyboardShortcutsProvider>
      <AdminShell>
        <SocketBridge />
        <Suspense fallback={<ShellContentLoader />}>
          <Outlet />
        </Suspense>
      </AdminShell>
    </KeyboardShortcutsProvider>
  )
}

function ShellContentLoader() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
      Loading...
    </div>
  )
}
