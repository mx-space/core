# User Guide: Smart WebApp Template

## Quick Start Tutorial

This guide will walk you through setting up and building your first application with this modern React template.

### Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** installed
- **pnpm** package manager
- Basic knowledge of React and TypeScript

### Step 1: Project Setup

```bash
# Clone the template
git clone https://github.com/innei-template/smart-webapp-template my-app
cd my-app

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open http://localhost:5173 to see your application running.

### Step 2: Understanding the Project Structure

Your new project includes these key directories:

```
my-app/
├── src/
│   ├── components/ui/    # Pre-built UI components
│   ├── pages/           # Your application pages
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utility functions
├── docs/                # This documentation
└── package.json
```

## Building Your First Page

### Creating a New Page

1. **Create a page file** in `src/pages/(main)/`:

```tsx
// src/pages/(main)/about.sync.tsx
export const Component = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary">About Us</h1>
      <p className="mt-4 text-text-secondary">
        Welcome to our amazing application!
      </p>
    </div>
  )
}
```

2. **Save the file** - the route is automatically available at `/about`

3. **Navigate to http://localhost:5173/about** to see your new page

### Using UI Components

The template includes pre-built components in `src/components/ui/`. Here's how to use them:

#### Buttons
```tsx
import { Button } from '~/components/ui/button'

export const MyPage = () => (
  <div>
    <Button variant="primary">Primary Action</Button>
    <Button variant="secondary">Secondary Action</Button>
    <Button variant="ghost">Subtle Action</Button>
  </div>
)
```

#### Form Components
```tsx
import { Input } from '~/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '~/components/ui/select'
import { Checkbox } from '~/components/ui/checkbox'

export const ContactForm = () => (
  <form className="space-y-4">
    <Input type="email" placeholder="Your email" />
    
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Choose topic" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="support">Support</SelectItem>
        <SelectItem value="sales">Sales</SelectItem>
      </SelectContent>
    </Select>
    
    <div className="flex items-center space-x-2">
      <Checkbox id="newsletter" />
      <label htmlFor="newsletter">Subscribe to newsletter</label>
    </div>
    
    <Button type="submit">Send Message</Button>
  </form>
)
```

## Working with State

### Local Component State

For simple component state, use React's built-in hooks:

```tsx
import { useState } from 'react'
import { Button } from '~/components/ui/button'

export const Counter = () => {
  const [count, setCount] = useState(0)
  
  return (
    <div className="text-center">
      <p className="text-2xl mb-4">Count: {count}</p>
      <Button onClick={() => setCount(count + 1)}>
        Increment
      </Button>
    </div>
  )
}
```

### Global State with Jotai

For state shared across components, create Jotai atoms:

```tsx
// src/atoms/user.ts
import { atom } from 'jotai'
import { createAtomHooks } from '~/lib/jotai'

interface User {
  name: string
  email: string
}

const userAtom = atom<User | null>(null)

export const [
  userAtom,
  useUser,
  useUserValue,
  useSetUser,
] = createAtomHooks(userAtom)
```

```tsx
// Using the atom in components
import { useUser } from '~/atoms/user'

export const UserProfile = () => {
  const [user, setUser] = useUser()
  
  if (!user) {
    return <div>Please log in</div>
  }
  
  return (
    <div>
      <h2>Welcome, {user.name}!</h2>
      <p>{user.email}</p>
    </div>
  )
}
```

## Styling Your Components

### Using TailwindCSS

This template uses TailwindCSS with Apple UIKit colors:

```tsx
// System colors automatically adapt to light/dark mode
<div className="bg-fill text-primary p-4 rounded-lg">
  <h3 className="text-blue">Blue heading</h3>
  <p className="text-text-secondary">Secondary text</p>
</div>
```

### Common Color Classes

- **Text**: `text-primary`, `text-secondary`, `text-tertiary`
- **Backgrounds**: `bg-fill`, `bg-fill-secondary`, `bg-material-thick`
- **System Colors**: `text-blue`, `bg-green`, `border-red`

### Responsive Design

```tsx
<div className="
  text-sm          // Mobile
  md:text-base     // Tablet
  lg:text-lg       // Desktop
  xl:text-xl       // Large desktop
">
  Responsive text
</div>
```

### Dark Mode

Colors automatically adapt to dark mode. For custom styling:

```tsx
<div className="
  bg-white dark:bg-gray-900
  text-gray-900 dark:text-white
">
  Custom dark mode styles
</div>
```

## Handling User Interactions

### Click Handlers

```tsx
import { Button } from '~/components/ui/button'
import { toast } from 'sonner'

export const ActionButton = () => {
  const handleClick = () => {
    toast.success('Action completed!')
  }
  
  return (
    <Button onClick={handleClick}>
      Click me
    </Button>
  )
}
```

### Form Handling

```tsx
import { useState } from 'react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

export const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
  }
  
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Your name"
        value={formData.name}
        onChange={handleChange('name')}
      />
      <Input
        type="email"
        placeholder="Your email"
        value={formData.email}
        onChange={handleChange('email')}
      />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

## Adding Animations

This template includes Framer Motion for smooth animations:

### Basic Animations

```tsx
import { m } from 'motion/react'

export const AnimatedCard = () => (
  <m.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="bg-fill p-6 rounded-lg"
  >
    <h3>Animated Content</h3>
    <p>This card animates in smoothly</p>
  </m.div>
)
```

### Interactive Animations

```tsx
import { m } from 'motion/react'
import { Button } from '~/components/ui/button'

export const HoverButton = () => (
  <m.div
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <Button>Hover me!</Button>
  </m.div>
)
```

## Working with APIs

### Using React Query

```tsx
// src/hooks/api/usePosts.ts
import { useQuery } from '@tanstack/react-query'

interface Post {
  id: number
  title: string
  body: string
}

export const usePosts = () => {
  return useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts')
      return response.json()
    },
  })
}
```

```tsx
// Using the query in a component
import { usePosts } from '~/hooks/api/usePosts'

export const PostsList = () => {
  const { data: posts, isLoading, error } = usePosts()
  
  if (isLoading) return <div>Loading posts...</div>
  if (error) return <div>Error loading posts</div>
  
  return (
    <div className="space-y-4">
      {posts?.map(post => (
        <div key={post.id} className="bg-fill p-4 rounded-lg">
          <h3 className="font-semibold">{post.title}</h3>
          <p className="text-text-secondary">{post.body}</p>
        </div>
      ))}
    </div>
  )
}
```

## Navigation and Routing

### Linking Between Pages

```tsx
import { Link } from 'react-router'

export const Navigation = () => (
  <nav className="flex space-x-4">
    <Link to="/" className="text-blue hover:underline">
      Home
    </Link>
    <Link to="/about" className="text-blue hover:underline">
      About
    </Link>
    <Link to="/contact" className="text-blue hover:underline">
      Contact
    </Link>
  </nav>
)
```

### Dynamic Routes

Create dynamic routes using square brackets:

```tsx
// src/pages/(main)/posts/[id].sync.tsx
import { useParams } from 'react-router'

export const Component = () => {
  const { id } = useParams()
  
  return (
    <div>
      <h1>Post #{id}</h1>
      {/* Load and display post content */}
    </div>
  )
}
```

### Programmatic Navigation

```tsx
import { useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'

export const BackButton = () => {
  const navigate = useNavigate()
  
  return (
    <Button 
      variant="ghost" 
      onClick={() => navigate(-1)}
    >
      ← Go Back
    </Button>
  )
}
```

## Common Patterns

### Modal Dialog

```tsx
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { m, AnimatePresence } from 'motion/react'

export const ModalExample = () => {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Modal
      </Button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <m.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-material-thick p-6 rounded-lg max-w-md w-full">
                <h2 className="text-xl font-semibold mb-4">Modal Title</h2>
                <p className="text-text-secondary mb-4">Modal content goes here.</p>
                <Button onClick={() => setIsOpen(false)}>
                  Close
                </Button>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

### Loading States

```tsx
import { Button } from '~/components/ui/button'
import { useState } from 'react'

export const LoadingButton = () => {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleSubmit = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsLoading(false)
  }
  
  return (
    <Button 
      onClick={handleSubmit}
      isLoading={isLoading}
      loadingText="Saving..."
    >
      Save Changes
    </Button>
  )
}
```

### Error Boundaries

```tsx
// src/components/common/ErrorBoundary.tsx
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError(): State {
    return { hasError: true }
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold text-red">Something went wrong</h2>
          <p className="text-text-secondary mt-2">Please refresh the page</p>
        </div>
      )
    }
    
    return this.props.children
  }
}
```

## Best Practices

### Component Organization

1. **Keep components focused** - One responsibility per component
2. **Extract custom hooks** for complex logic
3. **Use TypeScript strictly** - Define proper interfaces
4. **Compose over inheritance** - Build complex UIs from simple parts

### Performance Tips

1. **Use React.memo** for expensive components:
```tsx
import { memo } from 'react'

export const ExpensiveComponent = memo(({ data }) => {
  // Complex rendering logic
  return <div>{/* component content */}</div>
})
```

2. **Lazy load routes** for code splitting:
```tsx
// src/pages/(main)/heavy-page.tsx (note: .tsx not .sync.tsx)
export const Component = () => {
  return <div>This page is lazy loaded</div>
}
```

3. **Use useCallback** for event handlers:
```tsx
import { useCallback, useState } from 'react'

export const OptimizedComponent = () => {
  const [count, setCount] = useState(0)
  
  const handleClick = useCallback(() => {
    setCount(c => c + 1)
  }, [])
  
  return <Button onClick={handleClick}>Count: {count}</Button>
}
```

### Code Style

1. **Use descriptive names** for variables and functions
2. **Keep functions small** - aim for single responsibility
3. **Comment complex logic** but not obvious code
4. **Use TypeScript types** instead of interfaces when possible

## Troubleshooting

### Common Issues

#### Routes not updating
If new routes aren't appearing, restart the development server:
```bash
pnpm dev
```

#### TypeScript errors
Clear the TypeScript cache:
```bash
rm -rf node_modules/.cache
pnpm dev
```

#### Styling not applying
Clear Tailwind cache:
```bash
rm -rf node_modules/.cache
pnpm dev
```

#### Build errors
Run a full type check:
```bash
pnpm build
```

### Getting Help

1. **Check the console** for error messages
2. **Use React DevTools** to inspect component state
3. **Check the documentation** in the `docs/` folder
4. **Review the example components** in `src/components/ui/`

## Next Steps

Now that you've learned the basics, explore these advanced topics:

1. **Custom Hooks** - Create reusable logic ([Development Guide](./DEVELOPMENT.md))
2. **Component API** - Deep dive into component props ([API Documentation](./API.md))
3. **Architecture** - Understand the project structure ([Architecture Guide](./ARCHITECTURE.md))

Happy building! 🚀