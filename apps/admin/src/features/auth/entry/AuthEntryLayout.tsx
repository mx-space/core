import { Outlet, useLocation } from 'react-router'

import { AuthExperience } from './AuthExperience'

export function AuthEntryLayout() {
  const { pathname } = useLocation()
  return (
    <AuthExperience
      initialScene={
        pathname === '/setup-api'
          ? 'connect'
          : pathname === '/setup'
            ? 'welcome'
            : 'login'
      }
    >
      <Outlet />
    </AuthExperience>
  )
}
