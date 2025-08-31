import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

// UI State
export const sidebarOpenAtom = atomWithStorage('dashboard-sidebar-open', true)
export const mobileDrawerOpenAtom = atom(false)
export const currentRouteAtom = atom('')

// User State
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: string[]
}

export const userAtom = atom<User | null>(null)
export const userPermissionsAtom = atom<string[]>([])

// Real-time Data State
export const notificationCountAtom = atom(0)
export const pendingCommentsCountAtom = atom(0)
export const unreadFeedbackCountAtom = atom(0)

// Navigation State
export interface NavigationItem {
  id: string
  label: string
  icon: string
  route: string
  badge?: () => number | string
  description?: string
  children?: NavigationItem[]
  permission?: string[]
  highlight?: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
  active?: boolean
}

// Navigation Structure
export const navigationStructure: NavigationItem[] = [
  {
    id: 'dashboard',
    label: '概览',
    icon: 'i-mingcute-dashboard-line',
    route: '/dashboard',
    description: '数据概览和快速操作',
  },
  {
    id: 'activity',
    label: '活动',
    icon: 'i-mingcute-chart-line-line',
    route: '/activity',
    description: '实时活动动态',
  },
]

export const navigationAtom = atom(navigationStructure)
export const breadcrumbAtom = atom<BreadcrumbItem[]>([])

// Derived State
export const filteredNavigationAtom = atom((get) => {
  const navigation = get(navigationAtom)
  const permissions = get(userPermissionsAtom)

  return navigation.filter((item) => {
    if (!item.permission) return true
    return item.permission.some((p) => permissions.includes(p))
  })
})

// Dashboard Stats
export interface DashboardStats {
  posts?: { total: number; change: number }
  comments?: { total: number; change: number }
  views?: { total: number; change: number }
  subscribers?: { total: number; change: number }
}

export const dashboardStatsAtom = atom<DashboardStats>({})

// Mobile Navigation Items
export interface MobileNavigationItem {
  icon: string
  label: string
  route?: string
  action?: string
  badge?: number | null
}

export const mobileNavigation: MobileNavigationItem[] = [
  {
    icon: 'i-mingcute-dashboard-line',
    label: '概览',
    route: '/dashboard',
  },
  {
    icon: 'i-mingcute-chart-line-line',
    label: '活动',
    route: '/activity',
  },
  {
    icon: 'i-mingcute-more-1-line',
    label: '更多',
    action: 'toggleDrawer',
  },
]
