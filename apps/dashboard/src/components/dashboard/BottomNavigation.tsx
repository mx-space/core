import { useAtom } from 'jotai'
import type { FC } from 'react'
import { useLocation, useNavigate } from 'react-router'

import type { MobileNavigationItem } from '~/atoms/dashboard'
import { mobileDrawerOpenAtom } from '~/atoms/dashboard'

interface BottomNavigationProps {
  navigation: MobileNavigationItem[]
}

const bottomNavStyles = {
  container:
    'fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-lg border-t border-border z-50',
  grid: 'grid grid-cols-5 h-full',

  item: {
    default:
      'flex flex-col items-center justify-center gap-1 transition-colors',
    inactive: 'text-placeholder-text',
    active: 'text-accent',

    icon: 'w-5 h-5',
    label: 'text-xs font-medium',
    badge:
      'absolute -top-1 -right-1 w-4 h-4 bg-red text-background text-xs rounded-full flex items-center justify-center',
  },
}

export const BottomNavigation: FC<BottomNavigationProps> = ({ navigation }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [, setMobileDrawerOpen] = useAtom(mobileDrawerOpenAtom)

  return (
    <nav className={bottomNavStyles.container}>
      <div className={bottomNavStyles.grid}>
        {navigation.map((item) => {
          const isActive =
            item.route && location.pathname.startsWith(item.route)

          return (
            <button
              key={item.label}
              type="button"
              className={`${bottomNavStyles.item.default} ${
                isActive
                  ? bottomNavStyles.item.active
                  : bottomNavStyles.item.inactive
              }`}
              onClick={() => {
                if (item.route) {
                  navigate(item.route)
                } else if (item.action === 'toggleDrawer') {
                  setMobileDrawerOpen(true)
                }
              }}
            >
              <div className="relative">
                <i className={`${item.icon} ${bottomNavStyles.item.icon}`} />
                {item.badge && (
                  <span className={bottomNavStyles.item.badge}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={bottomNavStyles.item.label}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
