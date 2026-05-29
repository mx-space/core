import { useEffect } from 'react'

import { MobileHamburger } from '~/ui/layout/mobile-hamburger'
import { useShellNav } from '~/ui/layout/shell-nav-context'

export function MobileHeaderAffordance() {
  const shellNav = useShellNav()
  const registerPageHeader = shellNav?.registerPageHeader
  useEffect(() => registerPageHeader?.(), [registerPageHeader])

  return <MobileHamburger />
}
