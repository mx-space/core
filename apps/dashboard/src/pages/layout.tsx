import { useAtom } from 'jotai'
import type { FC } from 'react'
import { Outlet } from 'react-router'

import {
  filteredNavigationAtom,
  mobileDrawerOpenAtom,
  mobileNavigation,
  sidebarOpenAtom,
} from '~/atoms/dashboard'
import { BottomNavigation } from '~/components/dashboard/BottomNavigation'
import { Header } from '~/components/dashboard/Header'
import { MobileDrawer } from '~/components/dashboard/MobileDrawer'
import { Sidebar } from '~/components/dashboard/Sidebar'
import { useResponsiveLayout } from '~/hooks/common/useResponsiveLayout'

interface DashboardLayoutProps {
  children?: React.ReactNode
}

const DashboardLayout: FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useAtom(mobileDrawerOpenAtom)
  const [navigation] = useAtom(filteredNavigationAtom)
  const layout = useResponsiveLayout()

  const handleMenuToggle = () => {
    if (layout === 'mobile') {
      setMobileDrawerOpen(!mobileDrawerOpen)
    } else {
      setSidebarOpen(!sidebarOpen)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <Header onMenuToggle={handleMenuToggle} layout={layout} />

      <div className="flex">
        {/* Desktop/Tablet Sidebar */}
        {layout !== 'mobile' && (
          <Sidebar
            navigation={navigation}
            open={sidebarOpen}
            onToggle={setSidebarOpen}
          />
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 ${
            layout !== 'mobile' && sidebarOpen ? 'ml-60' : ''
          } ${layout === 'mobile' ? 'pb-14' : ''}`}
        >
          <div className="p-6">{children || <Outlet />}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {layout === 'mobile' && (
        <BottomNavigation navigation={mobileNavigation} />
      )}

      {/* Mobile Side Drawer */}
      {layout === 'mobile' && (
        <MobileDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          navigation={navigation}
        />
      )}
    </div>
  )
}

export default DashboardLayout
