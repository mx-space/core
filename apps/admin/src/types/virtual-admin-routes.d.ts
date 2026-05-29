declare module 'virtual:admin-routes' {
  import type { ComponentType, LazyExoticComponent } from 'react'
  import type { LucideIcon } from 'lucide-react'
  import type { TranslationKey } from '~/i18n/types'

  export interface AppRoute {
    path: string
    element: ComponentType | LazyExoticComponent<ComponentType>
    titleKey?: TranslationKey
    descriptionKey?: TranslationKey
    icon?: LucideIcon
    matchPaths?: string[]
    layout: 'shell' | 'public'
    hidden?: boolean
  }

  export interface SidebarNode {
    route: AppRoute
    children?: SidebarNode[]
  }

  export interface SidebarSection {
    titleKey?: TranslationKey
    order: number
    items: SidebarNode[]
  }

  export interface RedirectEntry {
    from: string
    to?: string
    element?: ComponentType
  }

  export const appRoutes: AppRoute[]
  export const publicRoutes: AppRoute[]
  export const shellRoutes: AppRoute[]
  export const sidebarTree: SidebarSection[]
  export const redirects: RedirectEntry[]
}
