import { Menu } from 'lucide-react'

import { useI18n } from '~/i18n'
import { useShellNav } from '~/ui/layout/shell-nav-context'
import { cn } from '~/utils/cn'

interface MobileHamburgerProps {
  className?: string
}

export function MobileHamburger(props: MobileHamburgerProps) {
  const shellNav = useShellNav()
  const { t } = useI18n()
  if (!shellNav) return null

  return (
    <button
      aria-label={t('common.openNavigation')}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:hover:bg-neutral-900 dark:hover:text-neutral-50',
        props.className,
      )}
      onClick={() => shellNav.toggle()}
      type="button"
    >
      <Menu aria-hidden="true" className="size-4" />
    </button>
  )
}
