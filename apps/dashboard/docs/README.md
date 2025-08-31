# Vite React TailwindCSS Template 🚀

Welcome to the Vite React TailwindCSS Template documentation. This collection of guides will help you get started and master the development patterns in this modern React template.

## 📚 Documentation Overview

### [🚀 User Guide](./USER_GUIDE.md)

**Start here for your first application**

- Quick setup tutorial
- Building your first page
- Working with UI components
- State management basics
- Common patterns and examples

Perfect for developers new to the template or looking for practical examples.

### [⚙️ Development Guide](./DEVELOPMENT.md)

**Comprehensive development workflows**

- Project structure and conventions
- Component development patterns
- Routing system
- State management with Jotai
- Styling guidelines
- Testing strategies
- Performance optimization

Essential for day-to-day development and understanding best practices.

### [🏗️ Architecture Documentation](./ARCHITECTURE.md)

**Deep dive into system design**

- Core architectural principles
- Component hierarchy and patterns
- State management strategy
- Routing architecture
- Provider composition
- Build and performance optimizations

Critical for understanding the template's design decisions and scaling your application.

### [📖 API Reference](./API.md)

**Complete component and hook documentation**

- UI component APIs and props
- Custom hook interfaces
- Utility function references
- State management patterns
- Color system documentation

Your go-to reference for component usage and available APIs.

## 🎯 Quick Navigation

### New to the Template?

1. **Start with [User Guide](./USER_GUIDE.md)** - Get your first app running
2. **Read [Development Guide](./DEVELOPMENT.md)** - Learn the development patterns
3. **Reference [API Documentation](./API.md)** - Discover available components

### Building Features?

- **Components**: Check [API Reference](./API.md) for available UI components
- **State**: See [Development Guide](./DEVELOPMENT.md#state-management) for Jotai patterns
- **Routing**: Read [Development Guide](./DEVELOPMENT.md#routing-system) for file-based routing
- **Styling**: Review [Development Guide](./DEVELOPMENT.md#styling-guidelines) for TailwindCSS best practices

### Understanding the System?

- **Architecture**: Read [Architecture Documentation](./ARCHITECTURE.md) for system design
- **Performance**: See [Architecture Documentation](./ARCHITECTURE.md#build-and-performance-architecture)
- **Patterns**: Review [Development Guide](./DEVELOPMENT.md#component-development) for component patterns

## 🔍 What's Included

This template provides:

### 🎨 **Modern UI Components**

- **Button variants**: Primary, secondary, ghost, destructive with loading states
- **Form components**: Input, Select, Checkbox with built-in validation styling
- **Layout components**: ScrollArea, Tooltip, Accordion with smooth animations
- **Design system**: Apple UIKit colors with automatic dark/light mode

### 🚀 **Development Experience**

- **Vite 7**: Lightning-fast dev server and optimized builds
- **TypeScript**: Full type safety with strict configuration
- **File-based routing**: Automatic route generation from file structure
- **Hot reloading**: Instant updates with state preservation

### 📱 **Production Ready**

- **Responsive design**: Mobile-first with TailwindCSS utilities
- **Performance optimized**: Code splitting, tree shaking, asset optimization
- **Accessibility**: Built on Radix UI primitives with keyboard navigation
- **SEO friendly**: Proper meta tags and semantic HTML structure

## 💡 Key Features

### State Management

- **Jotai**: Atomic state management with minimal boilerplate
- **React Query**: Server state caching and synchronization
- **Local state**: React hooks for component-specific state

### Animation System

- **Framer Motion**: Declarative animations with performance optimization
- **Spring physics**: Natural motion with customizable spring presets
- **Lazy loading**: Animation features loaded on demand

### Styling Architecture

- **TailwindCSS 4**: Latest utility-first CSS framework
- **Design tokens**: Consistent spacing, colors, and typography
- **Theme system**: Automatic dark/light mode with smooth transitions

## 🛠️ Development Tools

### Code Quality

- **ESLint**: React and TypeScript best practices enforcement
- **Prettier**: Consistent code formatting
- **Git hooks**: Pre-commit linting and formatting

### Developer Experience

- **Code Inspector**: Alt+click navigation to component source
- **TypeScript checking**: Real-time type checking in development
- **Path mapping**: Clean imports with `~/` alias for `src/`

## 📋 Quick Reference

### Essential Commands

```bash
pnpm dev    # Start development server
pnpm build  # Build for production
pnpm lint   # Run ESLint with auto-fix
pnpm format # Format code with Prettier
```

### Key Directories

```
src/
├── components/ui/    # Reusable UI components
├── pages/           # File-based routing
├── hooks/           # Custom React hooks
├── atoms/           # Jotai state atoms
└── lib/             # Utility functions
```

### Common Imports

```tsx
// UI Components
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

// State Management
import { useUser } from '~/atoms/user'
import { useQuery } from '@tanstack/react-query'

// Utilities
import { cx } from '~/lib/cn'
import { useViewport } from '~/hooks/common/useViewport'
```

## 📖 Learning Path

### Beginner

1. **Setup**: Follow [User Guide Quick Start](./USER_GUIDE.md#quick-start-tutorial)
2. **First Page**: Create your [first page](./USER_GUIDE.md#building-your-first-page)
3. **Components**: Use [UI components](./USER_GUIDE.md#using-ui-components)
4. **State**: Learn [basic state management](./USER_GUIDE.md#working-with-state)

### Intermediate

1. **Patterns**: Study [component patterns](./DEVELOPMENT.md#component-development)
2. **Routing**: Master [file-based routing](./DEVELOPMENT.md#routing-system)
3. **Styling**: Apply [styling guidelines](./DEVELOPMENT.md#styling-guidelines)
4. **APIs**: Integrate [external APIs](./USER_GUIDE.md#working-with-apis)

### Advanced

1. **Architecture**: Understand [system design](./ARCHITECTURE.md)
2. **Performance**: Optimize [bundle and runtime](./ARCHITECTURE.md#build-and-performance-architecture)
3. **Patterns**: Implement [advanced patterns](./DEVELOPMENT.md#component-development)
4. **Testing**: Write [comprehensive tests](./DEVELOPMENT.md#testing-guidelines)

## 🤝 Contributing

When contributing to this template:

1. **Follow the patterns** described in the documentation
2. **Update documentation** for new features or changes
3. **Test thoroughly** using the guidelines in [Development Guide](./DEVELOPMENT.md#testing-guidelines)
4. **Maintain consistency** with existing code style and architecture

## 📝 Documentation Maintenance

This documentation is organized to be:

- **Progressive**: Start simple, add complexity gradually
- **Practical**: Focus on real-world usage and examples
- **Complete**: Cover all aspects from basics to advanced topics
- **Current**: Stay up-to-date with template changes

For documentation updates, ensure all guides remain synchronized and cross-references are valid.

---

**Ready to build something amazing?** Start with the [User Guide](./USER_GUIDE.md) and explore the power of modern React development! ⚡
