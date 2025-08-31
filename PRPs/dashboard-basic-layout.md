# MX Space Dashboard 基础布局实现

## 📋 概述

为 MX Space 博客管理系统创建完整的 Dashboard 基础布局，包含主布局结构、多模块导航系统和响应式设计。这个 Dashboard 将整合所有 40+ API 模块，提供统一的管理界面。

**目标位置**: `apps/dashboard/src/pages/(dashboard)/`  
**主要技术**: React 19, React Router 7, Jotai, TailwindCSS 4, Radix UI, Framer Motion
**实现目标**: 一次性完整实现可扩展的 Dashboard 基础架构

---

## 🎯 核心需求

### 功能需求

1. **主布局系统**: 侧边栏 + 主内容区的经典 Dashboard 布局
2. **多级导航**: 6 大功能模块，支持子页面导航和面包屑
3. **响应式设计**: 桌面端侧边栏，移动端底部导航 + 抽屉
4. **模块化架构**: 每个功能模块独立路由和布局组件
5. **实时更新**: 徽章数字、通知提醒等实时数据展示
6. **权限控制**: 基于用户角色的菜单项显示控制

### 技术需求

1. **文件路由**: 使用现有的 `vite-plugin-route-builder` 自动路由系统
2. **布局嵌套**: 支持多层布局嵌套 (主布局 > 模块布局 > 页面)
3. **状态管理**: Jotai 管理导航状态、用户信息、实时数据
4. **性能优化**: 路由懒加载、代码分割、缓存策略
5. **可访问性**: 键盘导航、ARIA 标签、屏幕阅读器支持

---

## 🏗️ 整体布局架构

### 桌面端布局 (≥1200px)
```
┌─────────────────────────────────────────────────────────────────┐
│ [🏠] MX Space    [🔍 Smart Search]    [🔔3] [@user] [⚙️] [🌙]   │ 64px
├─────────────────────────────────────────────────────────────────┤
│ 📊 Activity  📝 Write  📄 Content  💬 Engage  🤖 AI  📈 Insights│ 48px  
├─────────────────────────────────────────────────────────────────┤
│ ☀️ Good morning! You have 3 pending items          [▼ More]     │ 80px
├─────────────────────────────────────────────────────────────────┤
│ Activity Feed (60%)        │ Quick Actions (40%)                │
│                            │                                    │
│ ┌─ Activity Item ─────────┐ │ ┌─ Quick Actions ─────────────┐   │
│ │ 💬 2m ago               │ │ │ ✏️ Write New Post           │   │
│ │ New comment on "React"  │ │ │ 📊 View Analytics          │   │
│ │ by Zhang San            │ │ │ 💬 Moderate Comments       │   │
│ │                [Reply] │ │ │ 🔄 Sync Content            │   │
│ └─────────────────────────┘ │ │ 🤖 AI Content Ideas        │   │
│                            │ │ ⚙️ System Settings         │   │
│ ┌─ Activity Item ─────────┐ │ └─────────────────────────────┘   │
│ │ 📝 15m ago              │ │                                    │
│ │ Draft "Next.js" updated │ │ ┌─ AI Insights ─────────────┐    │
│ │                [Edit ✎] │ │ │ 📈 Weekly Growth: +8%      │    │
│ └─────────────────────────┘ │ │ 🔥 Hot Topics:            │    │
│                            │ │   • Next.js                │    │
│ [Load More...]             │ │   • TypeScript             │    │
│                            │ │ 💡 AI Suggestions: 3       │    │
│                            │ └─────────────────────────────┘    
└─────────────────────────┴──────────────────────────────────────────┘
```

### 移动端布局 (<768px)
```
┌─────────────────────────────────────┐
│ [☰] MX Space      [🔔] [@user] [•] │ 56px
├─────────────────────────────────────┤
│ 📊 Dashboard                        │ 48px Tab
├─────────────────────────────────────┤
│                                     │
│ ┌─ Page Content ─────────────────┐  │
│ │                               │  │
│ │  [页面内容区域]                │  │
│ │                               │  │
│ │  根据不同页面显示:              │  │
│ │  • 统计卡片 (Dashboard)       │  │
│ │  • 内容列表 (管理页面)         │  │
│ │  • 表单 (设置/编辑)           │  │
│ │                               │  │
│ └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ [📊] [📝] [💬] [⚙️] [•••]         │ 56px
└─────────────────────────────────────┘
```

---

## 🗂️ 导航结构设计

### 主导航架构
```typescript
interface NavigationItem {
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

const navigationStructure: NavigationItem[] = [
  {
    id: 'dashboard',
    label: '概览',
    icon: 'i-mingcute-dashboard-line',
    route: '/dashboard',
    description: '数据概览和快速操作'
  },
  
]
```

---

## 🗂️ 文件路由结构

### 路由文件组织
```
src/pages/
│   ├── layout.tsx                    # 主 Dashboard 布局
│   ├── index.sync.tsx               # 概览页面 (Dashboard 首页)
```

---

## 🎨 核心组件设计规范

### 1. 主 Dashboard 布局组件
```typescript
// src/pages/(dashboard)/layout.tsx
interface DashboardLayoutProps {
  children: React.ReactNode
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom)
  const [user] = useAtom(userAtom)
  const layout = useResponsiveLayout()
  
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <Header 
        user={user}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        layout={layout}
      />
      
      <div className="flex">
        {/* 侧边栏 (桌面端) */}
        {layout === 'desktop' && (
          <Sidebar 
            navigation={navigationStructure}
            open={sidebarOpen}
            onToggle={setSidebarOpen}
          />
        )}
        
        {/* 主内容区 */}
        <main className={`flex-1 ${layout === 'desktop' && sidebarOpen ? 'ml-60' : ''}`}>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* 移动端底部导航 */}
      {layout === 'mobile' && (
        <BottomNavigation navigation={mobileNavigation} />
      )}
      
      {/* 移动端侧滑抽屉 */}
      {layout === 'mobile' && (
        <MobileDrawer 
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigation={navigationStructure}
        />
      )}
    </div>
  )
}
```

### 2. 顶部导航栏设计
```typescript
// src/components/dashboard/Header.tsx
interface HeaderProps {
  user: User
  onMenuToggle: () => void
  layout: 'desktop' | 'tablet' | 'mobile'
}

const headerStyles = {
  container: 'h-16 bg-background border-b border-border px-6 flex items-center justify-between',
  
  left: {
    brand: 'flex items-center gap-3',
    logo: 'w-8 h-8 bg-accent rounded-lg flex items-center justify-center',
    title: 'text-lg font-semibold text-text hidden sm:block'
  },
  
  right: {
    actions: 'flex items-center gap-2',
    button: 'w-10 h-10 rounded-lg hover:bg-fill flex items-center justify-center',
    avatar: 'w-8 h-8 rounded-full bg-fill'
  }
}

const Header = ({ user, onMenuToggle, layout }: HeaderProps) => {
  return (
    <header className={headerStyles.container}>
      {/* 左侧 Logo 区域 */}
      <div className={headerStyles.left.brand}>
        {layout === 'mobile' && (
          <button onClick={onMenuToggle} className={headerStyles.right.button}>
            <i className="i-mingcute-menu-line w-5 h-5" />
          </button>
        )}
        
        <div className={headerStyles.left.logo}>
          <i className="i-mingcute-lightning-line w-5 h-5 text-background" />
        </div>
        
        <h1 className={headerStyles.left.title}>MX Space Dashboard</h1>
      </div>
      
      {/* 右侧操作区域 */}
      <div className={headerStyles.right.actions}>
        {/* 通知按钮 */}
        <button className={headerStyles.right.button}>
          <i className="i-mingcute-notification-line w-5 h-5" />
          {/* 通知徽章 */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red text-background text-xs rounded-full">
            3
          </span>
        </button>
        
        {/* 设置按钮 */}
        <button className={headerStyles.right.button}>
          <i className="i-mingcute-settings-3-line w-5 h-5" />
        </button>
        
        {/* 主题切换 */}
        <ThemeToggle />
        
        {/* 用户头像 */}
        <UserDropdown user={user} />
      </div>
    </header>
  )
}
```

### 3. 侧边栏导航设计
```typescript
// src/components/dashboard/Sidebar.tsx
interface SidebarProps {
  navigation: NavigationItem[]
  open: boolean
  onToggle: (open: boolean) => void
}

const sidebarStyles = {
  container: 'fixed left-0 top-16 h-[calc(100vh-4rem)] w-60 bg-background border-r border-border transition-transform duration-300',
  
  navigation: {
    container: 'p-4 space-y-2 overflow-y-auto h-full',
    section: 'space-y-1',
    sectionTitle: 'px-3 py-2 text-xs font-semibold text-placeholder-text uppercase tracking-wider'
  },
  
  item: {
    default: 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    inactive: 'text-placeholder-text hover:text-text hover:bg-fill',
    active: 'text-accent bg-accent/10',
    
    icon: 'w-5 h-5 flex-shrink-0',
    label: 'flex-1',
    badge: 'ml-auto px-2 py-0.5 bg-red text-background text-xs rounded-full',
    chevron: 'w-4 h-4 transition-transform'
  },
  
  submenu: {
    container: 'ml-8 mt-1 space-y-1',
    item: 'flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors',
    inactive: 'text-placeholder-text hover:text-text hover:bg-fill',
    active: 'text-accent bg-accent/10'
  }
}

const Sidebar = ({ navigation, open, onToggle }: SidebarProps) => {
  const location = useLocation()
  
  return (
    <aside className={`${sidebarStyles.container} ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <nav className={sidebarStyles.navigation.container}>
        {navigation.map((section) => (
          <div key={section.id} className={sidebarStyles.navigation.section}>
            {/* 一级菜单项 */}
            <NavigationItem 
              item={section}
              isActive={location.pathname.startsWith(section.route)}
              level={0}
            />
            
            {/* 二级菜单 */}
            {section.children && (
              <div className={sidebarStyles.submenu.container}>
                {section.children.map((child) => (
                  <NavigationItem
                    key={child.id}
                    item={child}
                    isActive={location.pathname === child.route}
                    level={1}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

### 4. 面包屑导航设计
```typescript
// src/components/dashboard/Breadcrumb.tsx
interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

interface BreadcrumbItem {
  label: string
  href?: string
  active?: boolean
}

const breadcrumbStyles = {
  container: 'flex items-center space-x-2 text-sm mb-6',
  item: 'flex items-center',
  link: 'text-placeholder-text hover:text-text transition-colors',
  active: 'text-text font-medium',
  separator: 'mx-2 text-placeholder-text'
}

const Breadcrumb = ({ items }: BreadcrumbProps) => {
  return (
    <nav className={breadcrumbStyles.container}>
      {items.map((item, index) => (
        <div key={index} className={breadcrumbStyles.item}>
          {index > 0 && (
            <i className={`i-mingcute-arrow-right-line w-4 h-4 ${breadcrumbStyles.separator}`} />
          )}
          
          {item.href && !item.active ? (
            <Link to={item.href} className={breadcrumbStyles.link}>
              {item.label}
            </Link>
          ) : (
            <span className={item.active ? breadcrumbStyles.active : breadcrumbStyles.link}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
```

### 5. 移动端底部导航设计
```typescript
// src/components/dashboard/BottomNavigation.tsx
interface BottomNavigationProps {
  navigation: MobileNavigationItem[]
}

interface MobileNavigationItem {
  icon: string
  label: string
  route?: string
  action?: string
  badge?: number | null
}

const bottomNavStyles = {
  container: 'fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-lg border-t border-border z-50',
  grid: 'grid grid-cols-5 h-full',
  
  item: {
    default: 'flex flex-col items-center justify-center gap-1 transition-colors',
    inactive: 'text-placeholder-text',
    active: 'text-accent',
    
    icon: 'w-5 h-5',
    label: 'text-xs font-medium',
    badge: 'absolute -top-1 -right-1 w-4 h-4 bg-red text-background text-xs rounded-full flex items-center justify-center'
  }
}

const BottomNavigation = ({ navigation }: BottomNavigationProps) => {
  const location = useLocation()
  
  return (
    <nav className={bottomNavStyles.container}>
      <div className={bottomNavStyles.grid}>
        {navigation.map((item) => {
          const isActive = item.route && location.pathname.startsWith(item.route)
          
          return (
            <button
              key={item.label}
              className={`${bottomNavStyles.item.default} ${
                isActive ? bottomNavStyles.item.active : bottomNavStyles.item.inactive
              }`}
              onClick={() => {
                if (item.route) {
                  navigate(item.route)
                } else if (item.action) {
                  // 执行特定操作，如打开抽屉
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

// 移动端导航配置
const mobileNavigation: MobileNavigationItem[] = [
  {
    icon: 'i-mingcute-dashboard-line',
    label: '概览',
    route: '/dashboard'
  },
   
]
```

---

## 🔧 状态管理架构

### Jotai 原子状态设计
```typescript
// src/atoms/dashboard.ts
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

// UI 状态
export const sidebarOpenAtom = atomWithStorage('dashboard-sidebar-open', true)
export const mobileDrawerOpenAtom = atom(false)
export const currentRouteAtom = atom('')

// 用户状态
export const userAtom = atom<User | null>(null)
export const userPermissionsAtom = atom<string[]>([])

// 实时数据状态
export const notificationCountAtom = atom(0)
export const pendingCommentsCountAtom = atom(0)
export const unreadFeedbackCountAtom = atom(0)

// 导航状态
export const navigationAtom = atom(navigationStructure)
export const breadcrumbAtom = atom<BreadcrumbItem[]>([])

// 派生状态
export const filteredNavigationAtom = atom((get) => {
  const navigation = get(navigationAtom)
  const permissions = get(userPermissionsAtom)
  
  return navigation.filter(item => {
    if (!item.permission) return true
    return item.permission.some(p => permissions.includes(p))
  })
})

// 实时数据获取
export const dashboardStatsAtom = atom(async () => {
  const response = await fetch('/api/dashboard/stats')
  return response.json()
})
```

---

## 🎨 核心页面布局示例

### 1. Dashboard 概览页
```typescript
// src/pages/(dashboard)/index.sync.tsx
export const Component = () => {
  const [stats] = useAtom(dashboardStatsAtom)
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard 概览</h1>
          <p className="text-placeholder-text mt-1">欢迎回来，查看您的博客数据</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <i className="i-mingcute-refresh-1-line w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button variant="primary">
            <i className="i-mingcute-download-line w-4 h-4 mr-2" />
            导出报告
          </Button>
        </div>
      </div>
      
      {/* 统计卡片区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="总文章数"
          value={stats?.posts?.total || 0}
          change={stats?.posts?.change || 0}
          icon="i-mingcute-file-text-line"
          color="blue"
        />
        <StatsCard
          title="评论数"
          value={stats?.comments?.total || 0}
          change={stats?.comments?.change || 0}
          icon="i-mingcute-chat-3-line"
          color="green"
        />
        <StatsCard
          title="访问量"
          value={stats?.views?.total || 0}
          change={stats?.views?.change || 0}
          icon="i-mingcute-eye-line"
          color="purple"
        />
        <StatsCard
          title="订阅数"
          value={stats?.subscribers?.total || 0}
          change={stats?.subscribers?.change || 0}
          icon="i-mingcute-user-follow-line"
          color="orange"
        />
      </div>
      
      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快速操作 */}
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
        
        {/* 最近活动 */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
      </div>
      
      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficChart />
        <ContentPerformanceChart />
      </div>
    </div>
  )
}
```

### 2. 内容管理模块布局
```typescript
// src/pages/(dashboard)/content/layout.tsx
export const Component = () => {
  const location = useLocation()
  const [breadcrumb] = useAtom(breadcrumbAtom)
  
  useEffect(() => {
    // 根据当前路由更新面包屑
    updateBreadcrumb(location.pathname)
  }, [location])
  
  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <Breadcrumb items={breadcrumb} />
      
      {/* 模块子导航 */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          <NavLink 
            to="/dashboard/content/posts"
            className={({ isActive }) => 
              `py-2 px-1 border-b-2 font-medium text-sm ${
                isActive 
                  ? 'border-accent text-accent' 
                  : 'border-transparent text-placeholder-text hover:text-text'
              }`
            }
          >
            文章管理
          </NavLink>
          <NavLink 
            to="/dashboard/content/pages"
            className={({ isActive }) => 
              `py-2 px-1 border-b-2 font-medium text-sm ${
                isActive 
                  ? 'border-accent text-accent' 
                  : 'border-transparent text-placeholder-text hover:text-text'
              }`
            }
          >
            页面管理
          </NavLink>
          <NavLink to="/dashboard/content/taxonomy">分类标签</NavLink>
          <NavLink to="/dashboard/content/media">媒体库</NavLink>
        </nav>
      </div>
      
      {/* 内容区域 */}
      <Outlet />
    </div>
  )
}
```

---

## ⚙️ 响应式设计策略

### 断点设计
```typescript
const breakpoints = {
  mobile: { max: '767px' },
  tablet: { min: '768px', max: '1199px' },
  desktop: { min: '1200px' }
}

interface ResponsiveConfig {
  mobile: {
    sidebar: 'hidden',          // 隐藏侧边栏
    navigation: 'bottom',       // 底部导航
    content: 'full-width',      // 全宽内容
    drawer: 'overlay'           // 浮层抽屉
  },
  
  tablet: {
    sidebar: 'collapsible',     // 可收起侧边栏
    navigation: 'sidebar',      // 侧边导航
    content: 'with-sidebar',    // 带侧边栏内容
    drawer: 'none'              // 无抽屉
  },
  
  desktop: {
    sidebar: 'always-visible',  // 始终显示
    navigation: 'sidebar',      // 侧边导航  
    content: 'with-sidebar',    // 带侧边栏内容
    drawer: 'none'              // 无抽屉
  }
}
```

### 响应式 Hook
```typescript
// src/hooks/useResponsiveLayout.ts
export const useResponsiveLayout = () => {
  const [layout, setLayout] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  
  useEffect(() => {
    const mediaQueries = {
      mobile: window.matchMedia('(max-width: 767px)'),
      tablet: window.matchMedia('(min-width: 768px) and (max-width: 1199px)'),
      desktop: window.matchMedia('(min-width: 1200px)')
    }
    
    const updateLayout = () => {
      if (mediaQueries.mobile.matches) {
        setLayout('mobile')
      } else if (mediaQueries.tablet.matches) {
        setLayout('tablet')
      } else {
        setLayout('desktop')
      }
    }
    
    // 初始化
    updateLayout()
    
    // 监听变化
    Object.values(mediaQueries).forEach(mq => {
      mq.addEventListener('change', updateLayout)
    })
    
    return () => {
      Object.values(mediaQueries).forEach(mq => {
        mq.removeEventListener('change', updateLayout)
      })
    }
  }, [])
  
  return layout
}
```

---

## ✅ 实现验证清单

### 开发验证
```bash
# 类型检查
cd apps/dashboard && npm run build

# 代码规范检查  
cd apps/dashboard && npm run lint

# 开发服务器启动测试
cd apps/dashboard && npm run dev
```

### 功能验证清单
- [ ] 主 Dashboard 布局正确渲染
- [ ] 侧边栏导航展开/收起功能正常
- [ ] 多级导航高亮状态正确
- [ ] 面包屑导航更新准确
- [ ] 移动端底部导航切换正常
- [ ] 移动端抽屉菜单正常工作
- [ ] 响应式断点切换流畅
- [ ] 路由跳转和嵌套布局正确
- [ ] 徽章数字实时更新
- [ ] 权限控制菜单显示正确

### 性能验证
- [ ] 页面首次加载时间 < 2s
- [ ] 路由切换延迟 < 300ms
- [ ] 移动端交互响应 < 100ms
- [ ] 内存占用合理 (< 50MB)
- [ ] 无明显的内存泄漏

---

## 🎯 实现优先级

**Phase 1 (核心布局)**:
1. 主 Dashboard 布局组件
2. 顶部导航栏
3. 侧边栏导航
4. 基础路由结构
5. 响应式断点切换

**Phase 2 (增强功能)**:
6. 面包屑导航
7. 移动端底部导航
8. 移动端抽屉菜单
9. 状态管理集成
10. 实时数据徽章

**Phase 3 (优化完善)**:
11. 动画和过渡效果
12. 键盘导航支持
13. 无障碍访问优化
14. 性能优化
15. 错误边界处理

---

## 💡 PRP 置信度评分: 9/10

**高置信度因素**:
- ✅ 明确的布局架构设计
- ✅ 完整的导航结构规划
- ✅ 详细的组件实现规范
- ✅ 清晰的文件路由组织
- ✅ 完善的响应式策略
- ✅ 现有技术栈完全兼容

**需要注意的风险**:
- 多层布局嵌套的复杂性管理
- 移动端手势交互实现细节

这个 PRP 提供了完整的 Dashboard 基础布局实现指南，可以支撑一次性成功实现。