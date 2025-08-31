# Development Guide

## Getting Started

### Prerequisites

- **Node.js**: 18 or higher
- **Package Manager**: pnpm (required)
- **Git**: For version control

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd smart-webapp-template

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Development Commands

### Core Commands

```bash
# Development
pnpm dev          # Start development server (localhost:5173)
pnpm build        # Build for production (TypeScript check + Vite build)
pnpm serve        # Preview production build

# Code Quality
pnpm lint         # Run ESLint with auto-fix
pnpm format       # Format TypeScript files with Prettier
```

### Development Server Features

- **Hot Module Replacement (HMR)**: Instant updates without losing state
- **TypeScript**: Real-time type checking via Vite checker plugin
- **Code Inspector**: `Alt + Click` any element to jump to source code
- **Auto Routes**: File-based routes generated automatically

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── ui/             # Base UI primitives
│   └── common/         # App-specific shared components
├── pages/              # File-based routing pages
│   └── (main)/         # Route group
├── hooks/              # Custom React hooks
│   └── common/         # Shared hooks
├── lib/                # Utility functions
├── providers/          # Context providers
├── atoms/              # Jotai state atoms
├── assets/             # Static assets
└── styles/             # Global styles
```

## Routing System

### File-Based Routing

Routes are automatically generated from files in `src/pages/`:

```
src/pages/
├── (main)/
│   ├── index.sync.tsx     # → /
│   ├── about.sync.tsx     # → /about
│   └── users/
│       ├── index.sync.tsx # → /users
│       └── [id].sync.tsx  # → /users/:id
```

### Route File Conventions

- **`.sync.tsx`**: Synchronous routes (no lazy loading)
- **`.tsx`**: Lazy-loaded routes
- **`[param]`**: Dynamic route parameters
- **`(group)`**: Route groups (doesn't affect URL)

### Creating New Routes

1. Create file in `src/pages/` following naming convention
2. Export `Component` and optional `loader`:

```tsx
// src/pages/(main)/profile.sync.tsx
import type { LoaderFunction } from 'react-router'

export const Component = () => {
  return <div>Profile Page</div>
}

export const loader: LoaderFunction = async ({ params }) => {
  // Optional data loading
  return null
}
```

3. Routes are auto-generated in `src/generated-routes.ts`

## Component Development

### Creating UI Components

1. **Create component directory**:
```bash
mkdir src/components/ui/my-component
```

2. **Create component file**:
```tsx
// src/components/ui/my-component/MyComponent.tsx
import { forwardRef } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'
import { cx } from '~/lib/cn'

const myComponentVariants = tv({
  base: 'base-styles',
  variants: {
    variant: {
      primary: 'primary-styles',
      secondary: 'secondary-styles',
    },
    size: {
      sm: 'small-styles',
      md: 'medium-styles',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {
  // Custom props
}

export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cx(myComponentVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)

MyComponent.displayName = 'MyComponent'
```

3. **Create index file**:
```tsx
// src/components/ui/my-component/index.ts
export { MyComponent } from './MyComponent'
export type { MyComponentProps } from './MyComponent'
```

### Component Patterns

#### 1. Compound Components
```tsx
// Root component
export const Select = ({ children, ...props }) => (
  <SelectPrimitive.Root {...props}>
    {children}
  </SelectPrimitive.Root>
)

// Sub-components
Select.Trigger = SelectTrigger
Select.Content = SelectContent
Select.Item = SelectItem
```

#### 2. AsChild Pattern
```tsx
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

// Usage
<Button asChild>
  <Link to="/profile">Profile</Link>
</Button>
```

#### 3. Controlled/Uncontrolled
```tsx
import { useControlled } from '~/hooks/common/useControlled'

interface InputProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}

export const Input = ({ value, defaultValue = '', onChange, ...props }: InputProps) => {
  const [inputValue, setInputValue] = useControlled(value, defaultValue, onChange)
  
  return (
    <input
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      {...props}
    />
  )
}
```

## State Management

### Jotai Atoms

#### Creating Atoms
```tsx
// src/atoms/user.ts
import { atom } from 'jotai'
import { createAtomHooks } from '~/lib/jotai'

interface User {
  id: string
  name: string
  email: string
}

const userAtom = atom<User | null>(null)

export const [
  userAtom,
  useUser,
  useUserValue,
  useSetUser,
  getUser,
  setUser
] = createAtomHooks(userAtom)
```

#### Using Atoms
```tsx
// In components
const [user, setUser] = useUser()
const user = useUserValue() // Read-only
const setUser = useSetUser() // Write-only

// Outside components
import { getUser, setUser } from '~/atoms/user'
const currentUser = getUser()
setUser(newUser)
```

#### Derived Atoms
```tsx
import { atom } from 'jotai'
import { userAtom } from './user'

export const userNameAtom = atom(
  (get) => get(userAtom)?.name ?? 'Anonymous'
)
```

### React Query Integration

```tsx
// src/hooks/api/useUserQuery.ts
import { useQuery } from '@tanstack/react-query'

export const useUserQuery = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
  })
}

// Usage in component
const { data: user, isLoading, error } = useUserQuery(userId)
```

## Styling Guidelines

### TailwindCSS Best Practices

#### 1. Use Design Tokens
```tsx
// Preferred: Use UIKit colors
<div className="bg-fill text-primary">Content</div>

// Avoid: Hard-coded colors
<div className="bg-gray-100 text-gray-900">Content</div>
```

#### 2. Responsive Design
```tsx
// Mobile-first approach
<div className="text-sm md:text-base lg:text-lg">
  Responsive text
</div>

// Use viewport hooks for complex logic
const isMobile = useViewport(v => !v.md)
```

#### 3. Dark Mode
```tsx
// Use theme-aware colors
<div className="bg-material-thick text-primary">
  Automatically adapts to theme
</div>

// Custom dark mode styles when needed
<div className="bg-white dark:bg-gray-900">
  Custom dark mode
</div>
```

### Component Styling Patterns

#### 1. Tailwind Variants
```tsx
import { tv } from 'tailwind-variants'

const buttonVariants = tv({
  base: 'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  variants: {
    variant: {
      primary: 'bg-blue text-white hover:bg-blue/90',
      secondary: 'bg-fill text-primary hover:bg-fill-secondary',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4',
      lg: 'h-12 px-6 text-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})
```

#### 2. Conditional Classes
```tsx
import { cx } from '~/lib/cn'

const className = cx(
  'base-class',
  isActive && 'active-class',
  {
    'error-class': hasError,
    'success-class': isSuccess,
  }
)
```

## Animation Guidelines

### Framer Motion Integration

#### 1. Lazy Loading
```tsx
import { LazyMotion, domAnimation, m } from 'motion/react'

// App-level setup (already configured)
<LazyMotion features={domAnimation} strict>
  <YourApp />
</LazyMotion>

// Use `m` instead of `motion`
<m.div animate={{ x: 100 }}>Animated content</m.div>
```

#### 2. Spring Presets
```tsx
import { Spring } from '~/lib/spring'

<m.div
  animate={{ scale: 1 }}
  transition={Spring.presets.gentle}
>
  Smooth animation
</m.div>
```

#### 3. Common Patterns
```tsx
// Entrance animation
<m.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={Spring.presets.smooth}
>
  Content
</m.div>

// Hover effects
<m.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
  Interactive button
</m.button>
```

## Testing Guidelines

### Component Testing
```tsx
// src/components/ui/button/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<Button isLoading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### Hook Testing
```tsx
// src/hooks/common/__tests__/useControlled.test.ts
import { renderHook, act } from '@testing-library/react'
import { useControlled } from '../useControlled'

describe('useControlled', () => {
  it('works in uncontrolled mode', () => {
    const { result } = renderHook(() => useControlled(undefined, 'default'))
    
    expect(result.current[0]).toBe('default')
    
    act(() => {
      result.current[1]('new value')
    })
    
    expect(result.current[0]).toBe('new value')
  })
})
```

## Performance Optimization

### Code Splitting
```tsx
// Lazy load heavy components
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

export const Page = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <HeavyComponent />
  </Suspense>
)
```

### Bundle Analysis
```bash
# Analyze bundle size
pnpm build
npx vite-bundle-analyzer dist
```

### Image Optimization
```tsx
// Use WebP format with fallback
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.png" alt="Description" />
</picture>
```

## Debugging

### Development Tools

#### 1. React Developer Tools
- Install React DevTools browser extension
- View component tree and props
- Debug Jotai atoms with Jotai DevTools

#### 2. Code Inspector
- `Alt + Click` any element to jump to source
- Configured via `code-inspector-plugin` in Vite

#### 3. TypeScript Errors
- Real-time type checking in Vite
- Run `pnpm build` for comprehensive type check

### Common Issues

#### Route Generation
```bash
# If routes aren't updating, restart dev server
pnpm dev
```

#### TypeScript Errors
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
pnpm dev
```

#### Styling Issues
```bash
# Clear Tailwind cache
rm -rf node_modules/.cache
pnpm dev
```

## Deployment

### Build Process
```bash
# Production build
pnpm build

# Output in `dist/` directory
# - Optimized assets
# - Code splitting
# - Tree shaking applied
```

### Environment Variables
```bash
# .env.local
VITE_API_URL=https://api.example.com
VITE_APP_NAME=My App
```

```tsx
// Access in code
const apiUrl = import.meta.env.VITE_API_URL
```

### Vercel Deployment
```json
// vercel.json (already configured)
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

## Code Quality

### ESLint Configuration
- Based on `eslint-config-hyoban`
- React-specific rules enabled
- Auto-fix on save
- Pre-commit hooks via `lint-staged`

### Git Hooks
```bash
# Pre-commit hook runs automatically
# - Prettier formatting
# - ESLint fixes
# - TypeScript checking
```

### Code Style Guidelines

1. **Prefer composition over inheritance**
2. **Use TypeScript strictly** - no `any` types
3. **Extract custom hooks** for complex logic
4. **Keep components focused** - single responsibility
5. **Use meaningful names** for variables and functions
6. **Document complex logic** with comments
7. **Test interactive components** and custom hooks