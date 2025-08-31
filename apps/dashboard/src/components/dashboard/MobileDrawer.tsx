import { AnimatePresence, m } from 'motion/react'
import type { FC } from 'react'
import { Link, useLocation } from 'react-router'

import type { NavigationItem } from '~/atoms/dashboard'
import { Spring } from '~/lib/spring'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  navigation: NavigationItem[]
}

const drawerStyles = {
  overlay: 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
  drawer:
    'fixed left-0 top-0 h-full w-80 bg-background border-r border-border shadow-xl',

  header: {
    container: 'flex items-center justify-between p-4 border-b border-border',
    title: 'text-lg font-semibold text-text',
    closeButton:
      'w-10 h-10 rounded-lg hover:bg-fill flex items-center justify-center transition-colors',
  },

  navigation: {
    container: 'p-4 space-y-2 overflow-y-auto',
    section: 'space-y-1 mb-6',
    sectionTitle:
      'px-3 py-2 text-xs font-semibold text-placeholder-text uppercase tracking-wider',
  },

  item: {
    default:
      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors w-full',
    inactive: 'text-placeholder-text hover:text-text hover:bg-fill',
    active: 'text-accent bg-accent/10',

    icon: 'w-5 h-5 flex-shrink-0',
    content: 'flex-1 text-left',
    label: 'block font-medium',
    description: 'block text-xs text-placeholder-text mt-0.5',
  },
}

export const MobileDrawer: FC<MobileDrawerProps> = ({
  open,
  onClose,
  navigation,
}) => {
  const location = useLocation()

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={Spring.presets.smooth}
            className={drawerStyles.overlay}
            onClick={onClose}
          />

          {/* Drawer */}
          <m.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={Spring.presets.smooth}
            className={drawerStyles.drawer}
          >
            {/* Header */}
            <div className={drawerStyles.header.container}>
              <h2 className={drawerStyles.header.title}>导航</h2>
              <button
                type="button"
                onClick={onClose}
                className={drawerStyles.header.closeButton}
              >
                <i className="i-mingcute-close-line w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className={drawerStyles.navigation.container}>
              <div className={drawerStyles.navigation.section}>
                {navigation.map((item) => (
                  <MobileNavigationItem
                    key={item.id}
                    item={item}
                    isActive={location.pathname.startsWith(item.route)}
                    onClose={onClose}
                  />
                ))}
              </div>

              {/* Additional Actions */}
              <div className={drawerStyles.navigation.section}>
                <div className={drawerStyles.navigation.sectionTitle}>设置</div>
                <button
                  type="button"
                  className={`${drawerStyles.item.default} ${drawerStyles.item.inactive}`}
                >
                  <i
                    className={`i-mingcute-settings-3-line ${drawerStyles.item.icon}`}
                  />
                  <div className={drawerStyles.item.content}>
                    <span className={drawerStyles.item.label}>系统设置</span>
                    <span className={drawerStyles.item.description}>
                      配置和偏好设置
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${drawerStyles.item.default} ${drawerStyles.item.inactive}`}
                >
                  <i
                    className={`i-mingcute-user-line ${drawerStyles.item.icon}`}
                  />
                  <div className={drawerStyles.item.content}>
                    <span className={drawerStyles.item.label}>个人资料</span>
                    <span className={drawerStyles.item.description}>
                      账户信息管理
                    </span>
                  </div>
                </button>
              </div>
            </nav>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface MobileNavigationItemProps {
  item: NavigationItem
  isActive: boolean
  onClose: () => void
}

const MobileNavigationItem: FC<MobileNavigationItemProps> = ({
  item,
  isActive,
  onClose,
}) => {
  const badge = item.badge?.()

  return (
    <Link
      to={item.route}
      onClick={onClose}
      className={`${drawerStyles.item.default} ${
        isActive ? drawerStyles.item.active : drawerStyles.item.inactive
      }`}
    >
      <i className={`${item.icon} ${drawerStyles.item.icon}`} />
      <div className={drawerStyles.item.content}>
        <span className={drawerStyles.item.label}>{item.label}</span>
        {item.description && (
          <span className={drawerStyles.item.description}>
            {item.description}
          </span>
        )}
      </div>
      {badge && (
        <span className="ml-auto px-2 py-0.5 bg-red text-background text-xs rounded-full">
          {badge}
        </span>
      )}
    </Link>
  )
}
