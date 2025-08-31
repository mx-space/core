# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `pnpm dev` - Start development server with Vite HMR
- `pnpm build` - Build for production (runs TypeScript check + Vite build)
- `pnpm serve` - Preview production build

### Code Quality

- `pnpm lint` - Run ESLint with auto-fix
- `pnpm format` - Format TypeScript files with Prettier
- Package manager: **pnpm** (required, specified in packageManager field)

## Architecture

### Core Stack

- **Vite** + React 19 + TypeScript with file-based routing
- **State Management**: Jotai store with custom hooks (`src/lib/jotai.ts`)
- **UI Components**: Radix UI primitives + custom components in `src/components/ui/`
- **Styling**: TailwindCSS 4 with Pastel color system
- **Routing**: React Router with auto-generated routes via `vite-plugin-route-builder`

### Key Architectural Patterns

#### File-Based Routing

- Pages in `src/pages/` automatically generate routes via vite plugin
- Routes are generated in `src/generated-routes.ts` (auto-generated, do not edit)
- Route structure: `src/pages/(main)/index.sync.tsx` becomes root route

**Route Types**:
- **Sync Routes**: `.sync.tsx` files are synchronous routes without code splitting
- **Async Routes**: `.tsx` files are asynchronous routes with lazy loading and code splitting

**Layout System**:
- **Layout Files**: `layout.tsx` files serve as layout containers for their segment
- **Child Rendering**: Use `<Outlet />` within layout components to render child routes
- **Nesting**: Layouts automatically wrap their corresponding route segments

**Documentation Reference**:
- For detailed usage, advanced patterns, and configuration options, refer to the official documentation at [vite-plugin-route-builder](https://github.com/Innei/vite-plugin-route-builder)
- **Important**: When encountering unclear routing patterns or advanced use cases, always consult the official documentation before implementation

#### Component Organization

- **Base UI**: `src/components/ui/` - Reusable primitives (buttons, inputs, etc.)
- **Common**: `src/components/common/` - App-specific shared components
- **Modules**: `src/modules/` - Feature-specific components organized by domain
- **Path aliases**: Use `~/` for `src/` imports (configured in tsconfig)

**Module Architecture**:
- **Universal Components**: Generic UI components like `button`, `input`, `select` belong in `src/components/ui/`
- **Feature Components**: Domain-specific components should be organized by module in `src/modules/`
- **Example**: Feed-related components like `FeedTimeline`, `FeedSelector` go in `src/modules/feed/`
- **Principle**: If a component is specific to a business domain/feature, place it in the corresponding module directory

#### State Management

- Jotai store with custom `createAtomHooks` utility
- Global store instance: `jotaiStore` from `src/lib/jotai.ts`
- Atoms typically in `src/atoms/` directory

#### Provider Architecture

- Root providers in `src/providers/root-providers.tsx` with:
  - LazyMotion + MotionConfig for animations
  - QueryClient for React Query
  - Jotai Provider with global store
  - Context menu, event, and settings providers

#### Animation with Framer Motion

- **LazyMotion Integration**: Project uses Framer Motion with LazyMotion for optimized bundle size
- **Usage Rule**: Always use `m.` instead of `motion.` when creating animated components
- **Import**: `import { m } from 'motion/react'`
- **Examples**: `m.div`, `m.button`, `m.span` (not `motion.div`, `motion.button`, etc.)
- **Benefits**: Reduces bundle size while maintaining all Framer Motion functionality

**Animation Presets**:
- **Prefer Spring Presets**: Use predefined spring animations from `src/lib/spring.ts`
- **Available Presets Constants**: `Spring.presets.smooth`, `Spring.presets.snappy`, `Spring.presets.bouncy` (extracted from Apple's spring parameters)
- **Import**: `import { Spring } from '~/lib/spring'`
- **Usage Example**: `transition={Spring.presets.smooth}` or `transition={Spring.snappy(0.3, 0.1)}`
- **Customization**: All presets accept optional `duration` and `extraBounce` parameters

### Color System

- Uses Pastel color system via `@pastel-palette/tailwindcss`
- Kawaii-inspired OKLCH color space with sRGB and P3 fallbacks
- Three variants: regular (default), kawaii (softer), high-contrast (accessible)
- Defined in `.cursor/rules/color.mdc` - prefer these over standard Tailwind colors
- Dark mode support via TailwindCSS v4 built-in dark mode
- Color variants controlled via `data-contrast="low|high"` attributes

#### Color Categories & Usage

- **Semantic**: `text-text`, `bg-background`, `border-border` - core UI colors
- **Application**: `bg-accent`, `bg-primary`, `text-accent` - brand/action colors
- **Fill**: `bg-fill`, `bg-fill-secondary` - form controls, interactive elements, content containers
- **Material**: `bg-material-medium`, `bg-material-opaque` - glass morphism effects, overlays, semi-transparent surfaces

For complete color palette, usage details, and examples, visit the [Pastel GitHub repository](https://github.com/Innei/Pastel) and check the README for all available colors and implementation details.


### Icons

Use icons from tailwindcss. The following presets can be used:

- i-mingcute-
- i-lucide-
- i-simple-icons-

### Code Style Rules

- ESLint config: `eslint-config-hyoban` with React-specific rules
- No location global usage (use `useLocation` or route utilities instead)
- Self-closing JSX components enforced for .tsx files
- Formatting handled by Prettier with git hooks
