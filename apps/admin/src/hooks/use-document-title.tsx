import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { matchPath, useLocation } from 'react-router'
import type { AppRoute } from 'virtual:admin-routes'
import { appRoutes } from 'virtual:admin-routes'

import { useI18n } from '~/i18n'

const APP_NAME = 'Mx Space Admin'

const overrideStack: string[] = []
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

function pushOverride(title: string) {
  overrideStack.push(title)
  notify()
}

function removeOverride(title: string) {
  const i = overrideStack.lastIndexOf(title)
  if (i >= 0) {
    overrideStack.splice(i, 1)
    notify()
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getTopOverride(): string | null {
  return overrideStack.length ? overrideStack.at(-1) : null
}

interface RouteMatch {
  route: AppRoute
  pattern: string
  score: number
}

function scorePattern(pattern: string): number {
  const segs = pattern.split('/').filter(Boolean)
  let score = segs.length * 10
  for (const s of segs) {
    if (s.startsWith(':')) score -= 1
    else if (s === '*') score -= 5
  }
  return score
}

function findRouteAt(pathname: string, requireTitle: boolean): AppRoute | null {
  let best: RouteMatch | null = null
  for (const route of appRoutes) {
    if (requireTitle && !route.titleKey) continue
    const patterns = [route.path, ...(route.matchPaths ?? [])]
    for (const pattern of patterns) {
      if (!matchPath({ path: pattern, end: true }, pathname)) continue
      const score = scorePattern(pattern)
      if (!best || score > best.score) {
        best = { route, pattern, score }
      }
    }
  }
  return best?.route ?? null
}

function findBestRouteMatch(pathname: string): AppRoute | null {
  const direct = findRouteAt(pathname, true)
  if (direct) return direct
  // Detail pages typically lack titleKey (hidden). Walk URL ancestors until we
  // find a parent route whose titleKey we can borrow (e.g. /comments/:id → Comments).
  const segs = pathname.split('/').filter(Boolean)
  for (let n = segs.length - 1; n > 0; n--) {
    const parent = `/${segs.slice(0, n).join('/')}`
    const route = findRouteAt(parent, true)
    if (route) return route
  }
  return null
}

/**
 * Page-level override. Last-mount wins; cleared on unmount.
 * Falsy → no override (auto-resolved title from route metadata stays in effect).
 */
export function useDocumentTitle(title?: string | null | false) {
  useEffect(() => {
    if (!title) return
    pushOverride(title)
    return () => removeOverride(title)
  }, [title])
}

/**
 * Mount once near the router root. Watches location + locale + overrides,
 * resolves the best route metadata title, and writes `document.title`.
 */
export function DocumentTitleSync() {
  const location = useLocation()
  const { t } = useI18n()
  const override = useSyncExternalStore(
    subscribe,
    getTopOverride,
    getTopOverride,
  )

  const routeTitle = useMemo(() => {
    const route = findBestRouteMatch(location.pathname)
    return route?.titleKey ? t(route.titleKey) : null
  }, [location.pathname, t])

  useEffect(() => {
    const head = override ?? routeTitle
    document.title = head ? `${head} - ${APP_NAME}` : APP_NAME
  }, [override, routeTitle])

  return null
}
