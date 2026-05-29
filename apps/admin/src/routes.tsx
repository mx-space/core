import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { publicRoutes, redirects, shellRoutes } from 'virtual:admin-routes'

import { LegacyStaticRedirect } from './lib/legacy-redirects'

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route element={<Navigate replace to="/dashboard" />} path="/" />
        {publicRoutes.map((route) => {
          const Element = route.element
          return (
            <Route element={<Element />} key={route.path} path={route.path} />
          )
        })}
        {redirects.map((entry) => {
          if (entry.to) {
            return (
              <Route
                element={<LegacyStaticRedirect to={entry.to} />}
                key={entry.from}
                path={entry.from}
              />
            )
          }
          const Element = entry.element
          return Element ? (
            <Route element={<Element />} key={entry.from} path={entry.from} />
          ) : null
        })}
        {shellRoutes.map((route) => {
          const Element = route.element
          return (
            <Route element={<Element />} key={route.path} path={route.path} />
          )
        })}
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Routes>
    </Suspense>
  )
}

function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
      Loading...
    </div>
  )
}
