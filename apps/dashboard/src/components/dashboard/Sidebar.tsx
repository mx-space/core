import type { FC } from 'react'
import { Link, useLocation } from 'react-router'

import type { NavigationItem } from '~/atoms/dashboard'

interface SidebarProps {
  navigation: NavigationItem[]
  open: boolean
  onToggle?: (open: boolean) => void
}

const sidebarStyles = {
  container:
    'fixed left-0 top-16 h-[calc(100vh-4rem)] w-60 bg-background border-r border-border transition-transform duration-300 z-40',

  navigation: {
    container: 'p-4 space-y-2 overflow-y-auto h-full',
    section: 'space-y-1',
    sectionTitle:
      'px-3 py-2 text-xs font-semibold text-placeholder-text uppercase tracking-wider',
  },

  item: {
    default:
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    inactive: 'text-placeholder-text hover:text-text hover:bg-fill',
    active: 'text-accent bg-accent/10',

    icon: 'w-5 h-5 flex-shrink-0',
    label: 'flex-1',
    badge: 'ml-auto px-2 py-0.5 bg-red text-background text-xs rounded-full',
    chevron: 'w-4 h-4 transition-transform',
  },

  submenu: {
    container: 'ml-8 mt-1 space-y-1',
    item: 'flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors',
    inactive: 'text-placeholder-text hover:text-text hover:bg-fill',
    active: 'text-accent bg-accent/10',
  },
}

export const Sidebar: FC<SidebarProps> = ({ navigation, open }) => {
  const location = useLocation()

  return (
    <aside
      className={`${sidebarStyles.container} ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <nav className={sidebarStyles.navigation.container}>
        {navigation.map((section) => (
          <div key={section.id} className={sidebarStyles.navigation.section}>
            {/* Primary Navigation Item */}
            <NavigationItemComponent
              item={section}
              isActive={location.pathname.startsWith(section.route)}
              level={0}
            />

            {/* Secondary Navigation Items */}
            {section.children && (
              <div className={sidebarStyles.submenu.container}>
                {section.children.map((child) => (
                  <NavigationItemComponent
                    key={child.id}
                    item={child}
                    isActive={location.pathname === child.route}
                    level={1}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}

interface NavigationItemComponentProps {
  item: NavigationItem
  isActive: boolean
  level: number
}

const NavigationItemComponent: FC<NavigationItemComponentProps> = ({
  item,
  isActive,
  level,
}) => {
  const badge = item.badge?.()

  return (
    <Link
      to={item.route}
      className={`${
        level === 0 ? sidebarStyles.item.default : sidebarStyles.submenu.item
      } ${
        isActive
          ? level === 0
            ? sidebarStyles.item.active
            : sidebarStyles.submenu.active
          : level === 0
            ? sidebarStyles.item.inactive
            : sidebarStyles.submenu.inactive
      }`}
    >
      <i className={`${item.icon} ${sidebarStyles.item.icon}`} />
      <span className={sidebarStyles.item.label}>{item.label}</span>

      {badge && <span className={sidebarStyles.item.badge}>{badge}</span>}

      {item.children && (
        <i className={`i-mingcute-right-line ${sidebarStyles.item.chevron}`} />
      )}
    </Link>
  )
}
