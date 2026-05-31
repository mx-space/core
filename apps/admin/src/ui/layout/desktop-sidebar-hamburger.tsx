import { useAtom } from 'jotai'
import { PanelLeftOpen } from 'lucide-react'

import { useI18n } from '~/i18n'
import { sidebarCollapsedAtom } from '~/ui/layout/sidebar-layout'
import { cn } from '~/utils/cn'

interface Props {
  className?: string
}

export function DesktopSidebarHamburger(props: Props) {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom)
  const { t } = useI18n()
  if (!collapsed) return null

  return (
    <button
      aria-label={t('ui.layout.expandSidebar')}
      className={cn(
        'focus-visible:outline-hidden -ml-1.5 hidden size-9 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 lg:inline-flex',
        props.className,
      )}
      onClick={() => setCollapsed(false)}
      title={t('ui.layout.expandSidebar')}
      type="button"
    >
      <PanelLeftOpen aria-hidden="true" className="size-4" />
    </button>
  )
}
