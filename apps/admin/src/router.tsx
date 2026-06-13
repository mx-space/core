import { Suspense } from 'react'
import type { RouteObject } from 'react-router'
import { createHashRouter, Navigate, Outlet } from 'react-router'
import type { AppRoute, RedirectEntry } from 'virtual:admin-routes'
import { publicRoutes, redirects, shellRoutes } from 'virtual:admin-routes'

import { DocumentTitleSync } from './hooks/use-document-title'
import { ProtectedLayout } from './layouts/protected-layout'
import { LegacyStaticRedirect } from './lib/legacy-redirects'

function toRouteObject(route: AppRoute): RouteObject {
  return {
    path: route.path,
    Component: route.element,
    children: route.children?.map(toRouteObject),
  }
}

function redirectToRouteObject(entry: RedirectEntry): RouteObject | null {
  if (entry.to) {
    return {
      path: entry.from,
      element: <LegacyStaticRedirect to={entry.to} />,
    }
  }
  if (entry.element) {
    return { path: entry.from, Component: entry.element }
  }
  return null
}

function RootLayout() {
  return (
    <>
      <DocumentTitleSync />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}

function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
      Loading...
    </div>
  )
}

const routeTree: RouteObject[] = [
  {
    Component: RootLayout,
    children: [
      ...publicRoutes.map(toRouteObject),
      ...redirects
        .map(redirectToRouteObject)
        .filter((entry): entry is RouteObject => entry !== null),
      {
        Component: ProtectedLayout,
        children: [
          { index: true, element: <Navigate replace to="/dashboard" /> },
          ...shellRoutes.map(toRouteObject),
          { path: '*', element: <Navigate replace to="/dashboard" /> },
        ],
      },
    ],
  },
]

export const appRouter = createHashRouter(routeTree)
