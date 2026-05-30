import { ChevronDown } from 'lucide-react'
import { NavLink } from 'react-router'
import type { AppRoute, SidebarNode } from 'virtual:admin-routes'

import type { TranslationKey } from '~/i18n/types'
import { cn } from '~/utils/cn'

export type SidebarNavRoute = AppRoute
export type SidebarNavNode = SidebarNode

const activeLinkClassName =
  'bg-black/[0.04] text-fg font-medium dark:bg-white/[0.06]'
const inactiveLinkClassName =
  'font-normal text-fg-muted hover:bg-black/[0.04] hover:text-fg dark:hover:bg-white/[0.06]'

export function SidebarNavItem(props: {
  active: boolean
  depth: number
  isExpanded: (path: string) => boolean
  isRouteActive: (route: SidebarNavRoute) => boolean
  isNodeActive: (node: SidebarNavNode) => boolean
  node: SidebarNavNode
  onExpandedChange: (path: string) => void
  t: (key: TranslationKey) => string
}) {
  const Icon = props.node.route.icon
  const hasChildren = !!props.node.children?.length
  const expanded = props.isExpanded(props.node.route.path)
  const titleText = props.node.route.titleKey
    ? props.t(props.node.route.titleKey)
    : props.node.route.path
  const titleTooltip = props.node.route.descriptionKey
    ? props.t(props.node.route.descriptionKey)
    : titleText
  const isSelfRouteActive = props.isRouteActive(props.node.route)
  const parentClassName = cn(
    'grid w-full grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-sm text-left transition-colors',
    props.depth === 0 ? 'h-7 px-3 text-sm' : 'h-7 px-2 text-sm',
    isSelfRouteActive
      ? activeLinkClassName
      : props.active
        ? cn(
            'bg-black/[0.04] text-fg dark:bg-white/[0.06]',
            hasChildren ? 'font-medium' : 'font-normal',
          )
        : inactiveLinkClassName,
  )

  return (
    <div>
      {hasChildren ? (
        <div className="relative">
          <NavLink
            className={cn(parentClassName, 'pr-8')}
            data-scope-item="nav"
            title={titleTooltip}
            to={props.node.route.path}
          >
            {Icon ? (
              <Icon
                aria-hidden="true"
                className={cn(
                  'shrink-0',
                  props.depth === 0 ? 'size-4' : 'size-3.5',
                )}
              />
            ) : (
              <span aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{titleText}</span>
            <span aria-hidden="true" className="size-3.5" />
          </NavLink>
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${titleText}`}
            className={cn(
              'absolute inset-y-0 right-1 my-auto inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
              isSelfRouteActive
                ? 'text-fg-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.08]'
                : 'text-fg-subtle hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.08]',
            )}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              props.onExpandedChange(props.node.route.path)
            }}
            type="button"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-3.5 shrink-0 transition-transform',
                expanded ? 'rotate-180' : null,
              )}
            />
          </button>
        </div>
      ) : (
        <NavLink
          className={parentClassName}
          data-scope-item="nav"
          title={titleTooltip}
          to={props.node.route.path}
        >
          {Icon ? (
            <Icon
              aria-hidden="true"
              className={cn(
                'shrink-0',
                props.depth === 0 ? 'size-4' : 'size-3.5',
              )}
            />
          ) : (
            <span aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">{titleText}</span>
          <span aria-hidden="true" className="size-3.5" />
        </NavLink>
      )}

      {hasChildren ? (
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
            expanded
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0">
            <div className="ml-4 mt-0.5 grid gap-px border-l border-border pl-2">
              {props.node.children?.map((child) => (
                <SidebarNavItem
                  active={props.isNodeActive(child)}
                  depth={props.depth + 1}
                  isExpanded={props.isExpanded}
                  isRouteActive={props.isRouteActive}
                  isNodeActive={props.isNodeActive}
                  key={child.route.path}
                  node={child}
                  onExpandedChange={props.onExpandedChange}
                  t={props.t}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function collectActiveParentPaths(
  node: SidebarNavNode,
  activePath: string,
  currentPath: string,
): string[] {
  if (!node.children?.length) {
    return []
  }

  const activeChildPaths = node.children.flatMap((child) =>
    collectActiveParentPaths(child, activePath, currentPath),
  )
  const hasActiveDescendant =
    doesRouteMatch(node.route, activePath, currentPath) ||
    activeChildPaths.length > 0 ||
    node.children.some((child) =>
      doesRouteMatch(child.route, activePath, currentPath),
    )

  return hasActiveDescendant
    ? [node.route.path, ...activeChildPaths]
    : activeChildPaths
}

export function doesRouteMatch(
  route: SidebarNavRoute,
  activePath: string,
  currentPath: string,
) {
  return (
    route.path === activePath ||
    route.path === currentPath ||
    (route.matchPaths ?? []).some(
      (path) => path === activePath || path === currentPath,
    )
  )
}

export function filterSidebarNode(node: SidebarNavNode): SidebarNavNode | null {
  if (node.route.path === '/debug' || node.route.path.startsWith('/debug/')) {
    return null
  }

  if (!node.children?.length) {
    return node
  }

  const children = node.children.flatMap((child) => {
    const visibleChild = filterSidebarNode(child)

    return visibleChild ? [visibleChild] : []
  })

  return {
    ...node,
    children,
  }
}
