# Activity-Centered Dashboard Implementation

## 📋 Overview

Create a real-time, intelligent Activity-Centered Dashboard for the MX Space blog management system. This dashboard will serve as the primary interface for monitoring blog activity, managing content, and providing AI-driven insights through a modern React interface with Socket.IO real-time updates.

**Target Location**: `apps/dashboard/src/pages`
**Primary Technologies**: React 19, Socket.IO Client, Jotai, TailwindCSS 4, Radix UI, Framer Motion
**Implementation Goal**: One-pass complete implementation with comprehensive real-time functionality

---

## 🎯 Core Requirements

### Functional Requirements

1. **Real-time Activity Feed**: Display live blog activity (comments, posts, views, system events) with Socket.IO integration
2. **Smart Navigation**: Multi-level navigation with intelligent search and command palette (Cmd+K)  
3. **Mobile-First Responsive**: Adaptive layout for desktop (3-col), tablet (2-col), mobile (1-col + bottom actions)
4. **AI Integration**: Context-aware suggestions and insights powered by the existing AI module
5. **Interactive Elements**: Quick actions, context menus, swipe gestures, keyboard shortcuts
6. **Offline Support**: Queue operations during disconnection, sync when reconnected

### Technical Requirements

1. **Socket.IO Client**: Integrate with existing `/admin` namespace for authenticated real-time updates
2. **Jotai State Management**: Atomic state pattern following existing conventions
3. **Performance**: Virtual scrolling for activity feed, optimistic updates, intelligent caching
4. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
5. **Error Handling**: Graceful degradation, retry mechanisms, user feedback

---

## 🎨 Detailed UI Design Specifications

### Overall Layout Architecture

#### Desktop Layout (≥1200px)
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
│                            │ └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

#### Mobile Layout (<768px)
```
┌─────────────────────────────────────┐
│ [☰] MX Space              [🔔] [•] │ 56px
├─────────────────────────────────────┤
│ ☀️ Good morning!           [▼ More] │ 64px 
│ 📊 3 updates • 2 comments          │
├─────────────────────────────────────┤
│ 🕐 Live Activity                   │ 32px
│                                     │
│ ┌─ Activity Item ─────────────────┐ │
│ │ 💬 2m ago                       │ │ 96px
│ │ New comment on "React Guide"    │ │
│ │ by Zhang San                    │ │
│ │                        [Reply] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Activity Item ─────────────────┐ │
│ │ 📝 15m ago                      │ │ 80px
│ │ Draft "Next.js 15" updated      │ │ 
│ │                    [Continue ✎] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Load More...]                      │
├─────────────────────────────────────┤
│ [✏️ Write] [💬 Comments] [📊 Stats] │ 56px
└─────────────────────────────────────┘
```

### Component Design Specifications

#### 1. Navigation Header
```typescript
// Visual Specifications
const headerStyles = {
  height: '64px',
  background: 'bg-background',
  border: 'border-b border-border',
  padding: 'px-6 py-4',
  
  // Logo & Brand
  logo: {
    size: 'w-6 h-6',
    background: 'bg-accent',
    borderRadius: 'rounded-sm',
    icon: 'i-mingcute-lightning-line w-4 h-4 text-background'
  },
  
  // Search Bar
  search: {
    width: 'w-96',
    placeholder: '搜索内容、命令或询问 AI...',
    shortcut: 'Cmd+K',
    background: 'bg-fill hover:bg-fill-secondary',
    border: 'border border-border focus:border-accent',
    borderRadius: 'rounded-lg',
    padding: 'px-4 py-2'
  },
  
  // Action Icons
  actions: {
    size: 'w-10 h-10',
    background: 'bg-transparent hover:bg-fill',
    borderRadius: 'rounded-lg',
    iconSize: 'w-5 h-5'
  }
}
```

#### 2. Secondary Navigation Tabs
```typescript
const tabNavStyles = {
  container: {
    height: '48px',
    background: 'bg-background',
    borderBottom: 'border-b border-border',
    padding: 'px-6'
  },
  
  tab: {
    default: {
      padding: 'px-4 py-2',
      borderRadius: 'rounded-lg',
      fontSize: 'text-sm font-medium',
      color: 'text-placeholder-text',
      background: 'hover:bg-fill'
    },
    active: {
      color: 'text-text',
      background: 'bg-fill',
      borderBottom: '2px solid var(--accent)'
    },
    withBadge: {
      badge: {
        size: 'w-5 h-5',
        background: 'bg-red',
        color: 'text-background',
        fontSize: 'text-xs',
        borderRadius: 'rounded-full',
        position: 'absolute -top-1 -right-1'
      }
    }
  }
}
```

#### 3. Context Banner
```typescript
const contextBannerStyles = {
  container: {
    minHeight: '80px',
    background: 'bg-material-thin',
    border: 'border border-border',
    borderRadius: 'rounded-xl',
    padding: 'p-6',
    margin: 'mx-6 my-4'
  },
  
  greeting: {
    icon: 'w-6 h-6 text-accent',
    title: 'text-lg font-medium text-text',
    subtitle: 'text-sm text-placeholder-text mt-1'
  },
  
  expandable: {
    trigger: {
      background: 'hover:bg-fill',
      borderRadius: 'rounded-md',
      padding: 'p-1',
      icon: 'i-mingcute-arrow-down-line w-4 h-4 transition-transform'
    },
    expanded: {
      marginTop: 'mt-4',
      paddingTop: 'pt-4',
      borderTop: 'border-t border-border'
    }
  }
}
```

#### 4. Activity Item Design
```typescript
const activityItemStyles = {
  container: {
    background: 'bg-background hover:bg-material-thin',
    border: 'border border-border hover:border-border/70',
    borderRadius: 'rounded-xl',
    padding: 'p-4',
    margin: 'mb-3',
    transition: 'transition-all duration-200'
  },
  
  header: {
    layout: 'flex items-center gap-3 mb-2',
    avatar: {
      size: 'w-8 h-8',
      borderRadius: 'rounded-full',
      background: 'bg-fill'
    },
    meta: {
      name: 'text-sm font-medium text-text',
      time: 'text-xs text-placeholder-text',
      type: {
        comment: 'text-blue',
        post: 'text-green',
        system: 'text-yellow',
        urgent: 'text-red'
      }
    }
  },
  
  content: {
    title: 'text-base font-medium text-text mb-1',
    description: 'text-sm text-placeholder-text line-clamp-2',
    preview: {
      background: 'bg-fill/30',
      border: 'border border-border',
      borderRadius: 'rounded-lg',
      padding: 'p-3 mt-2'
    }
  },
  
  actions: {
    container: 'flex items-center gap-2 mt-3',
    button: {
      primary: 'bg-accent text-background hover:bg-accent/90 px-3 py-1.5 text-sm rounded-lg',
      secondary: 'bg-transparent text-accent hover:bg-accent/10 px-3 py-1.5 text-sm rounded-lg border border-accent'
    }
  },
  
  states: {
    unread: {
      indicator: 'w-2 h-2 bg-accent rounded-full absolute top-2 left-2'
    },
    pending: {
      background: 'bg-yellow/5 border-yellow/20',
      indicator: 'i-mingcute-time-line text-yellow'
    }
  }
}
```

#### 5. Quick Actions Panel
```typescript
const quickActionsStyles = {
  container: {
    background: 'bg-material-thin',
    border: 'border border-border',
    borderRadius: 'rounded-xl',
    padding: 'p-6'
  },
  
  header: {
    title: 'text-lg font-medium text-text mb-4',
    icon: 'i-mingcute-flash-line text-accent w-5 h-5'
  },
  
  actionGrid: {
    layout: 'grid grid-cols-1 gap-3',
    item: {
      background: 'bg-background hover:bg-fill',
      border: 'border border-border hover:border-border/70',
      borderRadius: 'rounded-lg',
      padding: 'p-4',
      transition: 'transition-all duration-200',
      
      icon: 'w-5 h-5 text-accent',
      title: 'font-medium text-text',
      subtitle: 'text-sm text-placeholder-text mt-1',
      
      withBadge: {
        badge: 'bg-red text-background text-xs px-2 py-0.5 rounded-full'
      }
    }
  }
}
```

#### 6. AI Insights Panel
```typescript
const aiInsightsStyles = {
  container: {
    background: 'bg-gradient-to-r from-accent/5 to-accent/10',
    border: 'border border-accent/20',
    borderRadius: 'rounded-xl',
    padding: 'p-6'
  },
  
  header: {
    layout: 'flex items-center gap-2 mb-4',
    icon: 'i-mingcute-magic-line text-accent w-5 h-5',
    title: 'font-medium text-text',
    badge: 'bg-accent/20 text-accent text-xs px-2 py-1 rounded-full ml-auto'
  },
  
  insight: {
    container: 'bg-background/50 rounded-lg p-4 mb-3 last:mb-0',
    icon: 'w-4 h-4 text-accent',
    content: 'text-sm text-text',
    action: 'text-accent hover:text-accent/80 text-sm font-medium mt-2 inline-flex items-center gap-1'
  }
}
```

### Mobile-Specific Design Elements

#### 1. Bottom Action Bar
```typescript
const bottomBarStyles = {
  container: {
    position: 'fixed bottom-0 left-0 right-0',
    height: '56px',
    background: 'bg-background/95 backdrop-blur-lg',
    border: 'border-t border-border',
    padding: 'px-4 py-2',
    zIndex: 'z-50'
  },
  
  actions: {
    layout: 'grid grid-cols-4 gap-2 h-full',
    item: {
      background: 'active:bg-fill',
      borderRadius: 'rounded-lg',
      layout: 'flex flex-col items-center justify-center',
      
      icon: 'w-5 h-5 text-placeholder-text',
      label: 'text-xs text-placeholder-text mt-1',
      
      active: {
        icon: 'text-accent',
        label: 'text-accent'
      },
      
      withBadge: {
        badge: 'absolute -top-1 -right-1 w-4 h-4 bg-red text-background text-xs rounded-full'
      }
    }
  }
}
```

#### 2. Mobile Navigation Drawer
```typescript
const drawerStyles = {
  overlay: 'fixed inset-0 bg-black/50 z-40',
  
  drawer: {
    container: 'fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50',
    header: {
      background: 'bg-material-thin',
      padding: 'p-6 border-b border-border',
      user: {
        avatar: 'w-10 h-10 rounded-full bg-fill',
        name: 'font-medium text-text',
        email: 'text-sm text-placeholder-text'
      },
      close: 'absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-fill'
    },
    
    search: {
      container: 'p-4 border-b border-border',
      input: 'w-full bg-fill border border-border rounded-lg px-4 py-2'
    },
    
    navigation: {
      container: 'flex-1 overflow-y-auto',
      item: {
        default: 'flex items-center gap-3 px-6 py-3 hover:bg-fill',
        active: 'bg-accent/10 text-accent border-r-2 border-accent',
        icon: 'w-5 h-5',
        label: 'font-medium',
        badge: 'ml-auto bg-red text-background text-xs px-2 py-0.5 rounded-full'
      }
    }
  }
}
```

### Animation & Interaction Specifications

#### 1. Micro-interactions
```typescript
const animations = {
  activityItemEntry: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: Spring.presets.smooth
  },
  
  buttonPress: {
    whileTap: { scale: 0.98 },
    transition: { duration: 0.1 }
  },
  
  hoverScale: {
    whileHover: { scale: 1.02 },
    transition: Spring.presets.snappy
  },
  
  slideIn: {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 }
  }
}
```

#### 2. Loading States
```typescript
const loadingStates = {
  skeleton: {
    activityItem: 'animate-pulse bg-fill rounded-xl h-24',
    text: 'animate-pulse bg-fill rounded h-4',
    avatar: 'animate-pulse bg-fill rounded-full w-8 h-8'
  },
  
  spinner: {
    container: 'flex items-center justify-center p-8',
    icon: 'i-mingcute-loading-line animate-spin w-6 h-6 text-accent'
  },
  
  pullToRefresh: {
    indicator: 'i-mingcute-arrow-down-line w-5 h-5 text-accent transform transition-transform',
    active: 'rotate-180'
  }
}
```

### Color & Typography System

#### 1. Color Usage Map
```typescript
const colorUsage = {
  primary: {
    accent: 'CTAs, active states, important elements',
    text: 'Primary text, headings',
    background: 'Main background'
  },
  
  secondary: {
    'placeholder-text': 'Secondary text, descriptions',
    border: 'Dividers, component borders',
    fill: 'Form controls, hover states'
  },
  
  semantic: {
    green: 'Success states, positive metrics',
    yellow: 'Warnings, pending states', 
    red: 'Errors, urgent notifications',
    blue: 'Information, links'
  },
  
  material: {
    'material-thin': 'Card backgrounds, panels',
    'material-medium': 'Overlays, dropdowns',
    'material-opaque': 'Modal backgrounds'
  }
}
```

#### 2. Typography Scale
```typescript
const typography = {
  heading: {
    h1: 'text-2xl font-bold text-text',
    h2: 'text-xl font-semibold text-text',
    h3: 'text-lg font-medium text-text'
  },
  
  body: {
    large: 'text-base text-text',
    default: 'text-sm text-text',
    small: 'text-xs text-placeholder-text'
  },
  
  interactive: {
    button: 'text-sm font-medium',
    link: 'text-accent hover:text-accent/80',
    caption: 'text-xs text-placeholder-text'
  }
}
```

---

## 🔍 Codebase Analysis & Patterns

### Existing Architecture Patterns

#### Component Structure (From `/src/components/ui/button/Button.tsx`)
```typescript
// Follows Tremor-style component pattern with tailwind-variants
const buttonVariants = tv({
  base: ['relative inline-flex items-center justify-center...'],
  variants: {
    variant: {
      primary: ['!border-transparent', 'text-background', 'bg-accent'],
      secondary: ['border-border', 'text-text', 'bg-background'],
    }
  }
})
```

#### Jotai State Pattern (From `/src/atoms/context-menu.ts`)
```typescript
// Custom atom hooks pattern
export const [
  contextMenuAtom,
  useContextMenuState, 
  useContextMenuValue,
  useSetContextMenu,
] = createAtomHooks(atom<ContextMenuState>({ open: false }))
```

#### Socket.IO Server Integration (From `/apps/core/src/processors/gateway/admin/events.gateway.ts`)
```typescript
// Admin namespace with JWT authentication
@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway extends AuthGateway {
  @SubscribeMessage('log')
  subscribeStdOut(client: Socket, data?: { prevLog?: boolean }) {
    // Existing pattern for real-time subscriptions
  }
}
```

### Design System Integration

#### Color System (From `apps/dashboard/CLAUDE.md`)
- **Semantic**: `text-text`, `bg-background`, `border-border`
- **Application**: `bg-accent`, `bg-primary`, `text-accent`
- **Fill**: `bg-fill`, `bg-fill-secondary` 
- **Material**: `bg-material-medium`, `bg-material-opaque`

#### Icons
- Available presets: `i-mingcute-`, `i-lucide-`, `i-simple-icons-`

#### Animation Standards
```typescript
// Use existing Spring presets from `/src/lib/spring.ts`
transition={Spring.presets.smooth}  // For smooth interactions
transition={Spring.presets.snappy}  // For quick feedback
transition={Spring.presets.bouncy}  // For playful elements
```

---

## 📚 External Documentation & Best Practices

### Socket.IO React Integration
**Reference**: https://socket.io/how-to/use-with-react

**Key Patterns**:
```typescript
// Single socket instance pattern
useEffect(() => {
  function onConnect() { setIsConnected(true) }
  function onDisconnect() { setIsConnected(false) }
  
  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)
  
  return () => {
    socket.off('connect', onConnect)
    socket.off('disconnect', onDisconnect)
  }
}, [])
```

### Jotai onMount Pattern
**Reference**: https://jotai.org/docs/core/atom

```typescript
// Subscription-based atom with cleanup
const dataAtom = atom(initialValue)
dataAtom.onMount = (setAtom) => {
  const socket = io('/admin', { auth: { token } })
  
  socket.on('activity:new', (data) => setAtom(prev => [data, ...prev]))
  
  return () => socket.disconnect()
}
```

### React Performance Best Practices (2024)
- Use `useCallback` for event handlers in loops
- Implement virtual scrolling for large lists
- Lazy load components with `React.lazy()`
- Optimize re-renders with `useMemo` for expensive calculations

---

## 🏗️ Implementation Blueprint

### Phase 1: Core Infrastructure
```typescript
// 1. Socket.IO Integration
// File: src/lib/socket-manager.ts
class AdvancedSocketManager {
  connect(namespace: string, token: string): Promise<Socket>
  safeEmit(event: string, data: any): Promise<any>
  setupReconnection(): void
  handleOfflineQueue(): void
}

// 2. Jotai Atoms Structure
// File: src/atoms/activity.ts
const activityFeedAtom = atom<ActivityItem[]>([])
const socketStatusAtom = atom<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
const unreadCountAtom = atom<number>(0)

// 3. Base Components
// Files: src/components/dashboard/activity/
// - ActivityFeed.tsx
// - ActivityItem.tsx  
// - NavigationHeader.tsx
// - ContextBanner.tsx
```

### Phase 2: Core Components
```typescript
// 4. Activity Feed with Virtual Scrolling
// File: src/components/dashboard/activity/ActivityFeed.tsx
const ActivityFeed = () => {
  const { activities, loadMore } = useActivitySocket()
  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    estimateSize: () => 120
  })
  // Implementation with intersection observer for infinite scroll
}

// 5. Smart Navigation
// File: src/components/dashboard/NavigationHeader.tsx  
const NavigationHeader = () => {
  const [searchOpen, setSearchOpen] = useState(false)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  return (
    <nav className="border-b border-border bg-background">
      {/* Multi-level navigation implementation */}
    </nav>
  )
}
```

### Phase 3: Advanced Features
```typescript
// 6. AI Insights Integration
// File: src/components/dashboard/activity/AIInsightsPanel.tsx
const AIInsightsPanel = () => {
  const { data: insights } = useQuery({
    queryKey: ['ai', 'activity-insights'],
    queryFn: () => fetchAIInsights(),
    refetchInterval: 5 * 60 * 1000
  })
  
  return (
    <div className="bg-material-thin rounded-xl p-6">
      {/* AI suggestions and insights */}
    </div>
  )
}

// 7. Mobile Responsive Layout
// File: src/hooks/useResponsiveLayout.ts
const useResponsiveLayout = () => {
  const [layout, setLayout] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  
  useEffect(() => {
    const mediaQueries = {
      mobile: window.matchMedia('(max-width: 767px)'),
      tablet: window.matchMedia('(min-width: 768px) and (max-width: 1199px)'),
      desktop: window.matchMedia('(min-width: 1200px)')
    }
    // Media query listeners for layout switching
  }, [])
  
  return layout
}
```

### Phase 4: Performance & Polish
```typescript
// 8. Offline Support
// File: src/hooks/useOfflineQueue.ts
const useOfflineQueue = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingActions, setPendingActions] = useAtom(pendingActionsAtom)
  
  const queueAction = useCallback((action: OfflineAction) => {
    if (isOnline) {
      return executeAction(action)
    } else {
      setPendingActions(prev => [...prev, action])
      return saveToLocalStorage(action)
    }
  }, [isOnline])
  
  return { queueAction, pendingCount: pendingActions.length }
}

// 9. Error Boundaries & Loading States
// File: src/components/dashboard/ErrorBoundary.tsx
const ActivityErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      FallbackComponent={ActivityErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Activity Dashboard Error:', error, errorInfo)
        // Report to error monitoring service
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

---

## 🛠️ Technical Implementation Details

### File Structure
```
src/
├── components/
│   └── dashboard/
│       └── activity/
│           ├── ActivityFeed.tsx
│           ├── ActivityItem.tsx
│           ├── ContextBanner.tsx
│           ├── QuickActions.tsx
│           ├── AIInsightsPanel.tsx
│           └── index.ts
├── atoms/
│   ├── activity.ts
│   ├── socket.ts
│   └── dashboard.ts
├── hooks/
│   ├── useActivitySocket.ts
│   ├── useResponsiveLayout.ts
│   └── useOfflineQueue.ts
├── lib/
│   ├── socket-manager.ts
│   └── activity-types.ts
└── pages/
    └── (dashboard)/
        └── activity/
            ├── layout.tsx
            ├── index.sync.tsx
            ├── live.tsx
            ├── history.tsx
            └── pending.tsx
```

### Data Types
```typescript
interface ActivityItem {
  id: string
  type: 'comment' | 'post' | 'page' | 'system' | 'ai' | 'analytics'
  timestamp: Date
  title: string
  description?: string
  author?: {
    id: string
    name: string
    avatar?: string
  }
  metadata?: {
    postId?: string
    importance: 'low' | 'medium' | 'high' | 'urgent'
  }
  actions?: ActivityAction[]
  isRead: boolean
  isPending: boolean
}

interface ActivityAction {
  id: string
  label: string
  icon: string
  type: 'primary' | 'secondary' | 'destructive'
  handler: (item: ActivityItem) => Promise<void>
  shortcut?: string
}
```

### Socket.IO Events
```typescript
// Client -> Server Events
'activity:get_feed' -> { page: number, limit: number }
'activity:mark_read' -> { activityId: string }
'activity:bulk_mark_read' -> { activityIds: string[] }
'dashboard:join' -> { preferences: object }
'comment:quick_reply' -> { commentId: string, content: string }

// Server -> Client Events  
'activity:new' -> { activity: ActivityItem, totalUnread: number }
'activity:updated' -> { activityId: string, updates: Partial<ActivityItem> }
'dashboard:stats' -> { onlineUsers: number, todayVisitors: number }
'ai:insight' -> AISuggestion
'system:notification' -> SystemNotification
```

---

## ⚠️ Critical Implementation Notes

### Gotchas & Common Pitfalls

1. **Socket.IO Client Version**: Ensure client version matches server (check `/apps/core/package.json`)
2. **JWT Token Handling**: Use existing auth token format from localStorage
3. **React Strict Mode**: Jotai atoms may mount/unmount twice in development
4. **Memory Leaks**: Always cleanup Socket.IO listeners in useEffect cleanup
5. **Mobile Safari**: Test touch events and viewport handling carefully
6. **Bundle Size**: Import Socket.IO client carefully to avoid including server code

### Performance Considerations

1. **Virtual Scrolling**: Essential for activity feeds with 100+ items
2. **Debounced Actions**: Batch Socket.IO emissions to prevent spam
3. **Image Loading**: Lazy load avatars and media content  
4. **State Updates**: Use immer for complex state updates in Jotai
5. **Bundle Splitting**: Keep Socket.IO code in separate chunk

### Security Requirements

1. **Token Validation**: Validate JWT tokens on every Socket.IO connection
2. **Rate Limiting**: Respect existing server-side rate limits
3. **XSS Prevention**: Sanitize user-generated content in activities
4. **CSRF Protection**: Use existing CSRF token patterns

---

## ✅ Validation Gates

### Development Validation
```bash
# Type checking
cd apps/dashboard && npm run build

# Linting
cd apps/dashboard && npm run lint

# Component testing (if tests exist)
cd apps/dashboard && npm test

# Bundle analysis
cd apps/dashboard && npm run build && ls -la dist/
```

### Runtime Validation
```bash
# Start development server
cd apps/dashboard && npm run dev

# Test Socket.IO connection
# Open browser console and verify:
# - Socket connection status
# - Event subscriptions
# - Activity feed updates
# - Mobile responsiveness
# - Keyboard shortcuts (Cmd+K, Cmd+1-6)
```

### Functional Testing Checklist
- [ ] Activity feed displays real-time updates
- [ ] Socket.IO connects and reconnects properly  
- [ ] Mobile layout adapts correctly at all breakpoints
- [ ] Command palette opens with Cmd+K
- [ ] Context menus work on right-click
- [ ] Offline queue functions during disconnection
- [ ] AI insights panel loads and updates
- [ ] Quick actions execute successfully
- [ ] Error boundaries catch and display errors
- [ ] Accessibility: keyboard navigation works
- [ ] Performance: smooth scrolling with 200+ activities

---

## 📈 Success Metrics

### Technical Metrics
- Socket.IO connection stability: >99% uptime
- Activity feed render performance: <100ms for new items
- Mobile responsiveness: Works on iOS Safari, Chrome Android  
- Bundle size impact: <500KB additional gzip
- Memory usage: No leaks during 1-hour session

### User Experience Metrics
- Time to first activity: <2 seconds
- Action response time: <500ms (optimistic updates)
- Offline functionality: Queue works for 24 hours
- Error recovery: Graceful fallback to HTTP APIs

---

## 🎯 Implementation Priority

**Priority 1** (Core MVP):
1. Socket.IO manager with auth
2. Basic activity feed with real-time updates
3. Navigation header with multi-level tabs
4. Mobile responsive layout
5. Error boundaries and loading states

**Priority 2** (Enhanced UX):
6. AI insights panel  
7. Command palette (Cmd+K)
8. Context menus and quick actions
9. Virtual scrolling performance
10. Offline queue functionality

**Priority 3** (Polish):
11. Advanced animations and transitions  
12. Keyboard shortcuts
13. Accessibility enhancements
14. Performance optimizations
15. Comprehensive error handling

---

## 💡 PRP Confidence Score: 9/10

**High Confidence Factors**:
- Comprehensive codebase pattern analysis
- Existing Socket.IO infrastructure ready
- Clear component architecture established
- External best practices researched
- Detailed technical specifications

**Moderate Risk Factors**:
- Complex state management with real-time data
- Mobile gesture handling implementation  
- Socket.IO auth integration details

This PRP provides comprehensive context for one-pass implementation success with the existing MX Space dashboard architecture and modern React patterns.