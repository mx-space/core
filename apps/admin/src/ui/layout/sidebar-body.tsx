import { Popover } from '@base-ui/react/popover'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import type { SidebarNode, SidebarSection } from 'virtual:admin-routes'
import { shellRoutes, sidebarTree } from 'virtual:admin-routes'

import { getOwner } from '~/api/options'
import { getAppInfo } from '~/api/system'
import { API_URL, GATEWAY_URL, WEB_URL } from '~/constants/env'
import { SESSION_WITH_LOGIN } from '~/constants/keys'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { SUPPORTED_LOCALES } from '~/i18n/resources'
import type { Locale, TranslationKey } from '~/i18n/types'
import type { ThemeMode } from '~/theme'
import { useThemeMode } from '~/theme'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import {
  collectActiveParentPaths,
  doesRouteMatch,
  filterSidebarNode,
  SidebarNavItem,
} from '~/ui/layout/sidebar-nav-item'
import { showContextMenu } from '~/ui/overlay/context-menu'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { authClient } from '~/utils/authjs/auth'
import { cn } from '~/utils/cn'

import faviconUrl from '../../../favicon.png'

const localeShortLabels = {
  'en-US': 'EN',
  'zh-CN': 'ZH',
} satisfies Record<Locale, string>
const themeModeLabelKeys = {
  dark: 'shell.theme.dark',
  light: 'shell.theme.light',
  system: 'shell.theme.system',
} satisfies Record<ThemeMode, TranslationKey>
const themeModeOptions: Array<{
  icon: typeof Sun
  value: ThemeMode
}> = [
  { icon: Sun, value: 'light' },
  { icon: Moon, value: 'dark' },
  { icon: Monitor, value: 'system' },
]

export function SidebarBody() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { locale, setLocale, t } = useI18n()
  const { setThemeMode, themeMode } = useThemeMode()
  const userMenuFloat = useFloatingZ('popover')
  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: ['shell', 'owner'],
    retry: false,
  })
  const appInfoQuery = useQuery({
    queryFn: getAppInfo,
    queryKey: ['shell', 'app-info'],
    retry: false,
  })
  const activeRoute =
    [...shellRoutes]
      .sort((a, b) => b.path.length - a.path.length)
      .find((route) => location.pathname.startsWith(route.path)) ??
    shellRoutes[0]
  const owner = ownerQuery.data
  const ownerName =
    owner?.name || owner?.username || owner?.handle || t('shell.owner.fallback')
  const ownerContact = owner?.mail || owner?.email || owner?.username
  const shouldShowDebugMenu =
    window.injectData.PAGE_PROXY || appInfoQuery.data?.version === 'dev'
  const isInApiDebugMode = Boolean(
    localStorage.getItem('__api') ||
    localStorage.getItem('__gateway') ||
    sessionStorage.getItem('__api') ||
    sessionStorage.getItem('__gateway') ||
    window.injectData.PAGE_PROXY,
  )
  const visibleSidebarNavigation: SidebarSection[] = useMemo(
    () =>
      shouldShowDebugMenu
        ? sidebarTree
        : sidebarTree
            .map((section) => ({
              ...section,
              items: section.items.flatMap((node) => {
                const visibleNode = filterSidebarNode(node)

                return visibleNode ? [visibleNode] : []
              }),
            }))
            .filter((section) => section.items.length > 0),
    [shouldShowDebugMenu],
  )
  const isRouteActive = (route: SidebarNode['route']) =>
    doesRouteMatch(route, activeRoute.path, location.pathname)
  const isNodeActive = (node: SidebarNode): boolean =>
    isRouteActive(node.route) ||
    (node.children ?? []).some((child) => isNodeActive(child))
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    const activeNodePaths = visibleSidebarNavigation
      .flatMap((section) => section.items)
      .flatMap((node) =>
        collectActiveParentPaths(node, activeRoute.path, location.pathname),
      )

    if (!activeNodePaths.length) {
      return
    }

    setExpandedPaths((previous) => {
      const next = new Set(previous)
      let changed = false

      activeNodePaths.forEach((path) => {
        if (!next.has(path)) {
          next.add(path)
          changed = true
        }
      })

      return changed ? next : previous
    })
  }, [activeRoute.path, location.pathname, visibleSidebarNavigation])

  const toggleExpandedPath = (path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous)

      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }

      return next
    })
  }
  const handleLogout = async () => {
    await authClient.signOut()
    sessionStorage.removeItem(SESSION_WITH_LOGIN)
    queryClient.clear()
    navigate('/login', { replace: true })
  }
  const handleBrandContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault()
    const version = appInfoQuery.data?.version ?? window.version ?? '—'
    showContextMenu([
      {
        disabled: true,
        key: 'version',
        label: `Version ${version}`,
      },
      { key: 'sep', type: 'divider' },
      {
        icon: ExternalLink,
        key: 'github',
        label: 'GitHub',
        onClick: () => {
          window.open(
            'https://github.com/mx-space',
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
    ])
  }

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 px-3',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div
          className="flex min-w-0 items-center gap-2 px-1 py-1"
          onContextMenu={handleBrandContextMenu}
        >
          <img
            alt=""
            className="size-5 shrink-0"
            decoding="async"
            src={faviconUrl}
          />
          <span className="truncate text-sm font-medium text-fg">Mx Space</span>
        </div>
        <Popover.Root>
          <Popover.Trigger
            className="outline-hidden flex shrink-0 items-center gap-1 rounded-sm p-1 transition-colors hover:bg-surface-inset data-[popup-open]:bg-surface-inset"
            title={ownerName}
            type="button"
          >
            {owner?.avatar ? (
              <img
                alt=""
                className="size-5 shrink-0 rounded-lg object-cover"
                decoding="async"
                src={owner.avatar}
              />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-xs font-medium text-fg-muted">
                {ownerName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className="size-3 shrink-0 text-fg-subtle"
            />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              align="end"
              side="bottom"
              sideOffset={8}
              style={{ zIndex: userMenuFloat.z }}
            >
              <PortalLayerScope depth={userMenuFloat.depth}>
                <Popover.Popup className="shadow-md outline-hidden w-64 rounded-lg bg-surface-overlay p-1 text-sm">
                  <div className="flex min-w-0 items-center gap-3 px-2 py-2">
                    {owner?.avatar ? (
                      <img
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                        decoding="async"
                        src={owner.avatar}
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-sm font-medium text-fg-muted">
                        {ownerName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-fg">
                        {ownerName}
                      </div>
                      {ownerContact ? (
                        <div className="mt-0.5 truncate text-xs text-fg-muted">
                          {ownerContact}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <button
                    className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
                    onClick={() => navigate('/setting?group=user')}
                    type="button"
                  >
                    <Settings aria-hidden="true" className="size-4" />
                    {t('ui.layout.accountSettings')}
                  </button>
                  <a
                    className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
                    href={WEB_URL}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    {t('common.openMainSite')}
                  </a>
                  <div className="my-1 h-px bg-border" />
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="shrink-0 text-xs text-fg-muted">
                      {t('ui.layout.preferences.theme')}
                    </span>
                    <div
                      aria-label={t('shell.theme.label')}
                      className="grid shrink-0 grid-cols-3 gap-0.5 rounded-sm bg-surface-inset p-0.5"
                      role="group"
                    >
                      {themeModeOptions.map((option) => {
                        const Icon = option.icon
                        const active = option.value === themeMode

                        return (
                          <button
                            aria-label={t(themeModeLabelKeys[option.value])}
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-sm text-fg-muted transition-colors hover:text-fg',
                              active
                                ? 'shadow-xs bg-surface-card text-fg'
                                : null,
                            )}
                            key={option.value}
                            onClick={() => setThemeMode(option.value)}
                            title={t(themeModeLabelKeys[option.value])}
                            type="button"
                          >
                            <Icon aria-hidden="true" className="size-3.5" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="shrink-0 text-xs text-fg-muted">
                      {t('ui.layout.preferences.language')}
                    </span>
                    <div className="w-20 shrink-0">
                      <SelectField
                        aria-label={t('shell.locale.label')}
                        onValueChange={setLocale}
                        options={SUPPORTED_LOCALES.map((value) => ({
                          label: localeShortLabels[value],
                          value,
                        }))}
                        popupClassName="text-xs"
                        triggerClassName="h-7 border-transparent bg-transparent px-2 text-xs font-medium text-fg-muted hover:bg-surface-inset"
                        value={locale}
                      />
                    </div>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <button
                    className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => void handleLogout()}
                    type="button"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {t('shell.logout')}
                  </button>
                </Popover.Popup>
              </PortalLayerScope>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <nav
        className="min-h-0 flex-1"
        aria-label={t('common.primaryNavigation')}
      >
        <Scroll className="h-full" innerClassName="flex flex-col gap-1.5 py-2">
          {visibleSidebarNavigation.map((section, sectionIndex) => (
            <div
              className="grid gap-px px-2"
              key={section.titleKey ?? `section-${sectionIndex}`}
            >
              {section.titleKey ? (
                <div className="px-3 pb-0.5 text-xs font-medium uppercase text-fg-subtle">
                  {t(section.titleKey)}
                </div>
              ) : null}
              {section.items.map((node) => (
                <SidebarNavItem
                  active={isNodeActive(node)}
                  depth={0}
                  isExpanded={(path) => expandedPaths.has(path)}
                  isRouteActive={isRouteActive}
                  isNodeActive={isNodeActive}
                  key={node.route.path}
                  node={node}
                  onExpandedChange={toggleExpandedPath}
                  t={t}
                />
              ))}
            </div>
          ))}
        </Scroll>
      </nav>

      {isInApiDebugMode ? (
        <NavLink
          className={cn(
            'flex items-center gap-1.5 border-t px-3 py-1.5 text-xs transition-colors',
            window.injectData.PAGE_PROXY
              ? 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-950/50'
              : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50',
          )}
          title={`Endpoint: ${API_URL || '-'}\nGateway: ${GATEWAY_URL || '-'}${
            window.injectData.PAGE_PROXY ? '\nLocal dev mode' : ''
          }`}
          to="/setup-api"
        >
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {window.injectData.PAGE_PROXY ? 'Local dev mode' : 'API debug mode'}
          </span>
        </NavLink>
      ) : null}
    </>
  )
}
