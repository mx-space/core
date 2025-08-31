# Architecture Documentation

## Overview

This React template follows a modern, scalable architecture built on Vite, React 19, and TypeScript. The design emphasizes developer experience, performance, and maintainability through well-defined patterns and conventions.

## Core Architecture Principles

### 1. Component-Driven Development
- **Atomic Design**: Components organized from primitive UI elements to complex compositions
- **Compound Components**: Complex UI broken into composable, reusable parts
- **Render Props Pattern**: Flexible composition via `asChild` prop and Radix Slot API

### 2. State Management Strategy
- **Atomic State**: Jotai for granular, reactive state management
- **Server State**: React Query for API data and caching
- **Local State**: React hooks for component-specific state

### 3. Type Safety First
- **Strict TypeScript**: Full type coverage with no `any` types
- **Variant Props**: Type-safe component variants via `tailwind-variants`
- **Path Mapping**: Clean imports with `~/` alias for `src/`

## Technology Stack

### Core Framework
- **React 19**: Latest React with concurrent features and improved hydration
- **TypeScript 5.8**: Full type safety with latest language features
- **Vite 7**: Ultra-fast development server and optimized builds

### State Management
- **Jotai**: Atomic state management with minimal boilerplate
- **React Query**: Server state, caching, and synchronization
- **React Context**: Cross-cutting concerns (theme, event handling)

### Styling & UI
- **TailwindCSS 4**: Utility-first CSS with modern features
- **Tailwind Variants**: Type-safe component variant system
- **Radix UI**: Accessible primitives for complex components
- **Framer Motion**: Declarative animations with LazyMotion

### Routing & Navigation
- **React Router 7**: Modern routing with data loading
- **File-Based Routing**: Automatic route generation from file structure
- **Nested Layouts**: Shared layouts with outlet-based composition

## Directory Structure

```
src/
├── components/          # Component library
│   ├── ui/             # Base UI primitives
│   │   ├── button/     # Button variants and compositions
│   │   ├── input/      # Form input components
│   │   ├── select/     # Dropdown and selection components
│   │   └── ...         # Other UI primitives
│   └── common/         # App-specific shared components
│       ├── ErrorElement.tsx
│       ├── Footer.tsx
│       └── NotFound.tsx
├── pages/              # File-based routing
│   └── (main)/         # Route group for main layout
├── hooks/              # Custom React hooks
│   └── common/         # Shared hook utilities
├── lib/                # Core utilities and configurations
├── providers/          # React Context providers
├── atoms/              # Jotai state atoms
├── assets/             # Static assets (fonts, images)
└── styles/             # Global CSS and Tailwind configuration
```

## Component Architecture

### UI Component Hierarchy

```
UI Components (src/components/ui/)
├── Primitives          # Basic building blocks
│   ├── Button          # Action triggers
│   ├── Input           # Form inputs
│   ├── Checkbox        # Boolean inputs
│   └── Divider         # Visual separators
├── Compositions        # Complex UI patterns
│   ├── Select          # Dropdown selections
│   ├── Accordion       # Collapsible content
│   ├── Tooltip         # Contextual information
│   └── ScrollArea      # Custom scrollable regions
└── Layout              # Structural components
    ├── Portal          # Render outside tree
    └── Background      # Decorative elements
```

### Component Design Patterns

#### 1. Compound Component Pattern
```typescript
// Root component with context
export const Select = ({ children, ...props }) => (
  <SelectPrimitive.Root {...props}>
    {children}
  </SelectPrimitive.Root>
)

// Composed sub-components
Select.Trigger = SelectTrigger
Select.Content = SelectContent
Select.Item = SelectItem
Select.Label = SelectLabel
```

#### 2. Variant-Driven Design
```typescript
import { tv, type VariantProps } from 'tailwind-variants'

const buttonVariants = tv({
  base: 'inline-flex items-center justify-center',
  variants: {
    variant: {
      primary: 'bg-blue text-white',
      secondary: 'bg-gray text-gray-dark',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

interface ButtonProps 
  extends React.ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof buttonVariants> {}
```

#### 3. Polymorphic Components
```typescript
interface ButtonProps {
  asChild?: boolean
  // ...other props
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} {...props} />
  },
)

// Usage: Renders as Link but styled as Button
<Button asChild>
  <Link to="/profile">Profile</Link>
</Button>
```

## State Management Architecture

### Jotai Atomic State

#### Atom Organization
```
src/atoms/
├── viewport.ts         # Screen size and breakpoint detection
├── route.ts           # Current route information
├── context-menu.ts    # Context menu state
└── theme.ts           # Dark/light theme state
```

#### Atom Creation Pattern
```typescript
import { atom } from 'jotai'
import { createAtomHooks } from '~/lib/jotai'

// Define atom with initial state
const userAtom = atom<User | null>(null)

// Generate hook utilities
export const [
  userAtom,        // Original atom
  useUser,         // [value, setValue] hook
  useUserValue,    // value-only hook
  useSetUser,      // setter-only hook
  getUser,         // direct getter (outside React)
  setUser          // direct setter (outside React)
] = createAtomHooks(userAtom)
```

#### Derived Atoms
```typescript
// Computed values from other atoms
const userDisplayNameAtom = atom(
  (get) => {
    const user = get(userAtom)
    return user ? `${user.firstName} ${user.lastName}` : 'Anonymous'
  }
)

// Async atoms for API integration
const userProfileAtom = atom(
  async (get) => {
    const userId = get(currentUserIdAtom)
    if (!userId) return null
    return await fetchUserProfile(userId)
  }
)
```

### React Query Integration

#### Query Organization
```typescript
// src/hooks/api/useUserQueries.ts
export const useUserQuery = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      queryClient.setQueryData(['user', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

## Routing Architecture

### File-Based Routing System

#### Route Generation Process
1. **Vite Plugin**: `@follow-app/vite-plugin-route-builder` scans `src/pages/`
2. **Route Discovery**: Finds files matching `**/*.tsx` pattern
3. **Route Generation**: Creates `src/generated-routes.ts` with type-safe routes
4. **Router Integration**: Routes consumed by React Router in `src/router.tsx`

#### Naming Conventions
```
src/pages/
├── (main)/                    # Route group (doesn't affect URL)
│   ├── index.sync.tsx        # → / (synchronous loading)
│   ├── about.tsx             # → /about (lazy loaded)
│   └── users/
│       ├── index.sync.tsx    # → /users
│       ├── [id].sync.tsx     # → /users/:id (dynamic route)
│       └── [id]/
│           └── edit.tsx      # → /users/:id/edit
```

#### Route Component Pattern
```typescript
// src/pages/(main)/users/[id].sync.tsx
import type { LoaderFunction } from 'react-router'

interface LoaderData {
  user: User
}

export const loader: LoaderFunction = async ({ params }) => {
  const user = await fetchUser(params.id!)
  return { user }
}

export const Component = () => {
  const { user } = useLoaderData() as LoaderData
  
  return (
    <div>
      <h1>{user.name}</h1>
      {/* Component content */}
    </div>
  )
}
```

### Router Configuration
```typescript
// src/router.tsx
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,           # Root layout
    children: routes,           # Auto-generated routes
    errorElement: <ErrorElement />,
  },
  {
    path: '*',
    element: <NotFound />,      # 404 fallback
  },
])
```

## Provider Architecture

### Provider Composition Strategy

#### Root Provider Setup
```typescript
// src/providers/root-providers.tsx
export const RootProviders: FC<PropsWithChildren> = ({ children }) => (
  <LazyMotion features={loadFeatures} strict>
    <MotionConfig transition={Spring.presets.smooth}>
      <QueryClientProvider client={queryClient}>
        <Provider store={jotaiStore}>
          <EventProvider />
          <StableRouterProvider />
          <SettingSync />
          <ContextMenuProvider />
          {children}
        </Provider>
      </QueryClientProvider>
    </MotionConfig>
    <Toaster />
  </LazyMotion>
)
```

#### Provider Composition Utility
```typescript
// src/components/common/ProviderComposer.tsx
export const ProviderComposer: Component<{
  contexts: JSX.Element[]
}> = ({ contexts, children }) =>
  contexts.reduceRight(
    (kids: any, parent: any) => cloneElement(parent, { children: kids }),
    children,
  )

// Usage for conditional providers
<ProviderComposer contexts={[
  <AuthProvider key="auth" />,
  isDevelopment && <DevToolsProvider key="devtools" />,
].filter(Boolean)}>
  <App />
</ProviderComposer>
```

#### Specialized Providers

1. **Event Provider**: Global event handling and keyboard shortcuts
2. **Context Menu Provider**: Right-click context menu state
3. **Setting Sync**: Synchronizes settings between atoms and localStorage
4. **Stable Router Provider**: Ensures router stability across re-renders

## Theme and Design System

### Apple UIKit Color Integration

#### Color System Architecture
```typescript
// Defined in .cursor/rules/color.mdc
System Colors: red, orange, yellow, green, mint, teal, cyan, blue, indigo, purple, pink, brown, gray
Fill Colors: fill, fill-secondary, fill-tertiary, fill-quaternary, fill-quinary
Text Colors: text, text-secondary, text-tertiary, text-quaternary, text-quinary
Material Colors: material-ultra-thick, material-thick, material-medium, material-thin, material-ultra-thin
```

#### Theme Implementation
```typescript
// src/hooks/common/useDark.ts
export const useIsDark = () => useAtomValue(isDarkAtom)
export const useThemeAtomValue = () => useAtomValue(themeAtom)
export const useSetTheme = () => useSetAtom(themeAtom)

// Theme sync with DOM
export const useSyncThemeark = () => {
  const isDark = useIsDark()
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])
}
```

### Responsive Design Strategy

#### Viewport Detection
```typescript
// src/atoms/viewport.ts
export const viewportAtom = atom({
  sm: boolean,    // 640px+
  md: boolean,    // 768px+
  lg: boolean,    // 1024px+
  xl: boolean,    // 1280px+
  '2xl': boolean, // 1536px+
  h: number,      // window height
  w: number,      // window width
})

// Usage in components
const isMobile = useViewport(v => !v.md)
const isDesktop = useViewport(v => v.lg)
```

## Animation Architecture

### Framer Motion Integration

#### Performance Optimization
```typescript
// Lazy loading animation features
const loadFeatures = () =>
  import('../framer-lazy-feature').then((res) => res.default)

// App-level setup
<LazyMotion features={loadFeatures} strict>
  <MotionConfig transition={Spring.presets.smooth}>
    <App />
  </MotionConfig>
</LazyMotion>
```

#### Spring Presets
```typescript
// src/lib/spring.ts
export const Spring = {
  presets: {
    gentle: { type: "spring", stiffness: 120, damping: 14 },
    smooth: { type: "spring", stiffness: 300, damping: 30 },
    snappy: { type: "spring", stiffness: 400, damping: 25 },
  }
}
```

#### Component Animation Patterns
```typescript
// Entrance animations
<m.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={Spring.presets.smooth}
>

// Interactive animations
<m.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={Spring.presets.snappy}
>
```

## Build and Performance Architecture

### Vite Configuration Optimizations

#### Plugin Stack
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    reactRefresh(),           // Fast refresh for React
    tsconfigPaths(),         // Path mapping support
    checker({                // TypeScript checking
      typescript: true,
      enableBuild: true,
    }),
    codeInspectorPlugin({    // Code navigation
      bundler: 'vite',
      hotKeys: ['altKey'],
    }),
    tailwindcss(),           // TailwindCSS processing
    routeBuilder({           # File-based routing
      pagePattern: `${resolve(ROOT, './src/pages')}/**/*.tsx`,
      outputPath: `${resolve(ROOT, './src/generated-routes.ts')}`,
    }),
  ],
})
```

#### Bundle Optimization
- **Tree Shaking**: ES modules enable dead code elimination
- **Code Splitting**: Automatic route-based splitting
- **Asset Optimization**: Vite handles image compression and format conversion
- **CSS Purging**: TailwindCSS removes unused styles

### Performance Monitoring

#### Bundle Analysis
```bash
# Analyze bundle size and composition
pnpm build
npx vite-bundle-analyzer dist
```

#### Runtime Performance
- **React DevTools Profiler**: Component render performance
- **Lighthouse**: Core Web Vitals monitoring
- **React Query DevTools**: Cache and network request analysis

## Security Architecture

### Content Security Policy
- **Strict CSP**: Prevents XSS attacks
- **Asset Integrity**: Subresource integrity for external resources
- **Secure Headers**: HTTPS enforcement and secure cookie settings

### Input Validation
- **TypeScript**: Compile-time type safety
- **Form Validation**: Runtime validation with type-safe schemas
- **Sanitization**: Safe HTML rendering and user input handling

## Development Architecture

### Code Quality Pipeline

#### Pre-commit Hooks
```json
// package.json
"simple-git-hooks": {
  "pre-commit": "pnpm exec lint-staged"
},
"lint-staged": {
  "*.{js,jsx,ts,tsx}": ["prettier --write"],
  "*.{js,ts,cjs,mjs,jsx,tsx,json}": ["eslint --fix"]
}
```

#### ESLint Configuration
- **Base Config**: `eslint-config-hyoban` for React best practices
- **Custom Rules**: Project-specific linting rules
- **TypeScript Integration**: Type-aware linting rules

### Development Experience

#### Hot Module Replacement
- **React Fast Refresh**: Preserves component state during updates
- **CSS HMR**: Instant style updates without page reload
- **TypeScript HMR**: Real-time type checking

#### Code Navigation
- **Path Mapping**: Clean imports with `~/` alias
- **Code Inspector**: Alt+click navigation to component source
- **TypeScript IntelliSense**: Full type information and autocomplete

## Deployment Architecture

### Build Output Structure
```
dist/
├── assets/                 # Hashed static assets
│   ├── index-[hash].js    # Main application bundle
│   ├── vendor-[hash].js   # Third-party dependencies
│   └── [component]-[hash].js # Code-split chunks
├── index.html             # Application entry point
└── manifest.json          # Build manifest
```

### Deployment Targets
- **Vercel**: Optimized for Vercel deployment with zero configuration
- **Static Hosting**: Can be deployed to any static hosting service
- **Docker**: Containerization support for custom deployments

This architecture provides a robust foundation for building scalable React applications with excellent developer experience, type safety, and performance characteristics.