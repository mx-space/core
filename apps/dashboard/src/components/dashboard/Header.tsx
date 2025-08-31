import { useAtom } from 'jotai'
import type { FC } from 'react'

import { notificationCountAtom, userAtom } from '~/atoms/dashboard'
import { Button } from '~/components/ui/button'
import type { LayoutType } from '~/hooks/common/useResponsiveLayout'

interface HeaderProps {
  onMenuToggle: () => void
  layout: LayoutType
}

const headerStyles = {
  container:
    'h-16 bg-background border-b border-border px-6 flex items-center justify-between',

  left: {
    brand: 'flex items-center gap-3',
    logo: 'w-8 h-8 bg-accent rounded-lg flex items-center justify-center',
    title: 'text-lg font-semibold text-text hidden sm:block',
  },

  right: {
    actions: 'flex items-center gap-2',
    button:
      'w-10 h-10 rounded-lg hover:bg-fill flex items-center justify-center transition-colors',
    avatar: 'w-8 h-8 rounded-full bg-fill',
  },
}

export const Header: FC<HeaderProps> = ({ onMenuToggle, layout }) => {
  const [user] = useAtom(userAtom)
  const [notificationCount] = useAtom(notificationCountAtom)

  return (
    <header className={headerStyles.container}>
      {/* Left Side - Brand */}
      <div className={headerStyles.left.brand}>
        {layout === 'mobile' && (
          <button
            type="button"
            onClick={onMenuToggle}
            className={headerStyles.right.button}
          >
            <i className="i-mingcute-menu-line w-5 h-5" />
          </button>
        )}

        <div className={headerStyles.left.logo}>
          <i className="i-mingcute-lightning-line w-5 h-5 text-background" />
        </div>

        <h1 className={headerStyles.left.title}>MX Space Dashboard</h1>
      </div>

      {/* Right Side - Actions */}
      <div className={headerStyles.right.actions}>
        {/* Search Button (hidden on mobile) */}
        <button
          type="button"
          className={`${headerStyles.right.button} hidden md:flex`}
        >
          <i className="i-mingcute-search-line w-5 h-5" />
        </button>

        {/* Notification Button */}
        <button
          type="button"
          className={`${headerStyles.right.button} relative`}
        >
          <i className="i-mingcute-notification-line w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red text-background text-xs rounded-full flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Settings Button (hidden on mobile) */}
        <button
          type="button"
          className={`${headerStyles.right.button} hidden sm:flex`}
        >
          <i className="i-mingcute-settings-3-line w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Dropdown */}
        <UserDropdown user={user} />
      </div>
    </header>
  )
}

// Theme Toggle Component
const ThemeToggle: FC = () => {
  // TODO: Implement theme toggle logic
  return (
    <button
      type="button"
      className="w-10 h-10 rounded-lg hover:bg-fill flex items-center justify-center transition-colors"
    >
      <i className="i-mingcute-moon-line w-5 h-5" />
    </button>
  )
}

// User Dropdown Component
interface UserDropdownProps {
  user: any
}

const UserDropdown: FC<UserDropdownProps> = ({ user }) => {
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent text-background flex items-center justify-center">
            <i className="i-mingcute-user-line w-4 h-4" />
          </div>
        )}
      </Button>
    </div>
  )
}
