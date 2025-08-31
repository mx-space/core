# AI Coding WebApp Demonstration Template 🤖

**Modern WebApp Template Optimized for AI-Assisted Development**

This is a meticulously designed Vite + React template that demonstrates how to maximize AI programming tools' effectiveness through standardized project structure and conventions. Features carefully crafted Claude and Cursor rules that showcase how to collaborate with AI to build high-quality WebApps.

## ✨ Core Features

### 🤖 AI Programming Optimization Showcase

- **Claude Rule Engineering** - Precisely guide AI behavior patterns and development habits through CLAUDE.md
- **Cursor Rule Integration** - Complete Cursor AI configuration rules in `.cursor/rules/` directory
- **Intelligent Architecture Design** - File organization structure optimized for AI understanding and code generation
- **Convention over Configuration** - Improve AI code generation quality through clear naming patterns and structural conventions
- **AI-Friendly Documentation** - Comprehensive project documentation to help AI quickly understand project context

### 🚀 Modern Tech Stack

- **Vite 5** - Lightning-fast build tool with HMR
- **React 19** - Latest React with concurrent features
- **TypeScript** - Complete type safety and IntelliSense
- **TailwindCSS 4** - Utility-first CSS framework with Pastel color system

### 🎨 Beautiful UI Component Library

- **Animated Components** - Smooth animations with Framer Motion and optimized Spring presets
- **Modern Design System** - Clean, elegant design inspired by Vercel
- **Theme Switching** - Automatic dark/light theme switching
- **Interactive Elements** - Buttons, tooltips, icons with micro-interactions

### 🛠️ Developer Experience

- **ESLint + Prettier** - Code formatting and quality checks
- **Git Hooks** - Pre-commit code validation
- **Auto Routing** - File-based routing system with React Router DOM
- **TypeScript Configuration** - Optimized type configuration and path mapping

### 📱 Production Ready

- **Responsive Design** - Mobile-first design approach
- **Build Optimization** - Code splitting and tree shaking
- **Modern Browser Support** - ES2020+ features
- **Vercel Deployment Ready** - Optimized configuration for Vercel deployment

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (package manager)
- **Cursor** (recommended) or **Claude Code** for AI-assisted development

### Installation

```bash
# Clone the template
git clone https://github.com/innei-template/smart-webapp-template
cd smart-webapp-template

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### 🤖 AI Programming Environment Setup

This template comes pre-configured with comprehensive AI programming rules:

#### Claude Rule Engineering
- **`CLAUDE.md`** - Contains detailed Claude AI behavior guidance rules
- **Project-Level Configuration** - Specific development conventions and patterns for this project
- **Global Rules** - User-level AI programming preferences and workflows

#### Cursor Integration Configuration
- **`.cursor/rules/`** - Contains dedicated Cursor AI rule sets
  - `component-organization.mdc` - Component organization standards
  - `routing.mdc` - Routing pattern guidance
  - `color.mdc` - Color system specifications
  - `styling.mdc` - Styling guidelines
  - `animation.mdc` - Animation implementation standards
  - `state-management.mdc` - State management patterns

#### Intelligent Conventions
- **File-Based Routing** - Architecture designed for easy AI understanding and generation
- **Component Architecture** - Clear component layering and naming conventions
- **State Management** - Jotai-based state management patterns, easy for AI to understand and extend

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (buttons, tooltips, etc.)
│   └── common/         # Common app components
├── pages/              # File-based routing pages
├── modules/            # Feature module components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
│   └── spring.ts       # Optimized animation presets
├── providers/          # Context providers
├── styles/             # Global styles and Tailwind config
└── assets/             # Static assets (fonts, images)

.cursor/
└── rules/              # Cursor AI rule configurations
    ├── component-organization.mdc
    ├── routing.mdc
    ├── color.mdc
    ├── styling.mdc
    ├── animation.mdc
    ├── state-management.mdc
    └── development.mdc

CLAUDE.md               # Claude AI project rules
```

## 🎨 UI Component System

### Button Components

- Multiple variants (primary, secondary, ghost, destructive)
- Animated loading states
- Framer Motion effects with optimized Spring presets

### Theme System

- Automatic dark/light mode detection
- Manual theme switching
- Persistent theme preferences
- Smooth transitions between themes

### Interactive Elements

- Animated tooltips
- Icon buttons with hover effects
- Context menus
- Loading indicators

## 🔧 Configuration

### TailwindCSS Configuration

The template uses TailwindCSS 4 with custom configurations:

- Pastel color system - OKLCH color space with sRGB and P3 fallbacks
- Typography hierarchy standards
- Animation utility classes
- Built-in dark mode support

### TypeScript Configuration

Path mapping configured for clean imports:

```typescript
import { Button } from '~/components/ui/button/Button'
import { useDark } from '~/hooks/common/useDark'
import { Spring } from '~/lib/spring'
```

### ESLint & Prettier

AI-friendly code standard configurations:

- React best practices
- TypeScript strict rules
- Import sorting standards
- Code formatting consistency

## 🤖 AI Programming Best Practices Showcase

### Claude Rule Engineering Key Points

1. **Clear Project Structure** - Define clear file organization rules through CLAUDE.md
2. **Convention over Configuration** - Use consistent naming and structural patterns
3. **Context Optimization** - Provide sufficient project information to help AI understand code intent
4. **Workflow Integration** - Define clear development processes and quality check standards

### Cursor Rule Collections

Each `.cursor/rules/*.mdc` file demonstrates domain-specific AI guidance principles:

- **Component Organization** - How to build maintainable component architecture
- **Routing Patterns** - Best practices for file-based routing
- **Styling System** - Consistent styling guidelines
- **State Management** - Clear state management patterns
- **Animation Standards** - Optimized animation implementations with Spring presets

### AI Collaborative Development Workflow

1. **Environment Setup** - Configure Claude/Cursor rules
2. **Structure Understanding** - AI quickly understands context through project structure
3. **Convention Adherence** - Generate code according to established rules
4. **Quality Assurance** - Automated checks and formatting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 📚 Documentation Resources

The project contains comprehensive AI programming guidance documentation:

- **[CLAUDE.md](./CLAUDE.md)** - Claude AI project rules and conventions
- **[.cursor/rules/](./.cursor/rules/)** - Cursor AI specialized rule collections
- **[Development Guide](#)** - Complete development workflow
- **[Architecture Documentation](#)** - System design and pattern descriptions

## 📄 License

This template is open source and available under the [MIT License](LICENSE).

2025 © Innei, Released under the MIT License.

> [Personal Website](https://innei.in/) · GitHub [@Innei](https://github.com/innei/)

## 🙏 Acknowledgments

- Design inspiration from [Vercel](https://vercel.com)
- Icons by [Mingcute](https://mingcute.com)
- Animations by [Framer Motion](https://www.framer.com/motion)
- Built with [Vite](https://vitejs.dev) and [React](https://react.dev)

---

**Ready to build something amazing?** ⚡
