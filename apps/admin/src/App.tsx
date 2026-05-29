import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { HashRouter, Navigate, useLocation } from 'react-router'
import { publicRoutes } from 'virtual:admin-routes'

import { checkLogged } from './api/auth'
import { useI18n } from './i18n'
import { AppProviders } from './providers'
import { AppRoutes } from './routes'
import { AdminShell } from './shell'
import { SocketBridge } from './socket/SocketBridge'
import { installThemeTokens } from './theme'

const publicPathSet = new Set(publicRoutes.map((route) => route.path))

function App() {
  useEffect(() => {
    document.title = 'Mx Space Admin'
    installThemeTokens()
  }, [])

  return (
    <AppProviders>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProviders>
  )
}

function AppContent() {
  const location = useLocation()

  if (publicPathSet.has(location.pathname)) {
    return <AppRoutes />
  }

  return <ProtectedAdminApp />
}

function ProtectedAdminApp() {
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
    <AdminShell>
      <SocketBridge />
      <AppRoutes />
    </AdminShell>
  )
}

// eslint-disable-next-line import/no-default-export
export default App
