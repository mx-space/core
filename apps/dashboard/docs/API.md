# Component API Documentation

## UI Components

### Button Component

**Location**: `src/components/ui/button/Button.tsx`

#### Props Interface
```typescript
interface ButtonProps extends React.ComponentPropsWithoutRef<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  loadingText?: string
}
```

#### Variants
- `primary` - Primary action button with blue background
- `secondary` - Secondary button with gray background  
- `light` - Light variant with subtle background
- `ghost` - Transparent button with hover effects
- `destructive` - Red variant for dangerous actions

#### Usage Examples
```tsx
// Basic usage
<Button variant="primary">Click me</Button>

// Loading state
<Button isLoading loadingText="Saving...">Save</Button>

// As child (renders as link)
<Button asChild>
  <Link to="/profile">Profile</Link>
</Button>
```

---

### Input Component

**Location**: `src/components/ui/input/Input.tsx`

#### Props Interface
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputStyles> {
  inputClassName?: string
}
```

#### Special Input Types
- `password` - Automatically includes visibility toggle
- `search` - Includes search icon
- `number` - Optional stepper controls via `enableStepper` prop
- `file` - Styled file input

#### Usage Examples
```tsx
// Basic input
<Input placeholder="Enter your name" />

// Password with toggle
<Input type="password" placeholder="Password" />

// Search input
<Input type="search" placeholder="Search..." />

// Number with steppers
<Input type="number" enableStepper min={0} max={100} />

// With error state
<Input hasError placeholder="Invalid input" />
```

---

### Select Component

**Location**: `src/components/ui/select/Select.tsx`

#### Compound Components
- `Select` - Root container
- `SelectTrigger` - Trigger button with size variants
- `SelectContent` - Dropdown content (portal rendered)
- `SelectItem` - Individual option
- `SelectLabel` - Section label
- `SelectSeparator` - Visual separator

#### Usage Examples
```tsx
<Select>
  <SelectTrigger size="sm">
    <SelectValue placeholder="Choose option" />
  </SelectTrigger>
  <SelectContent>
    <SelectLabel>Fruits</SelectLabel>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
    <SelectSeparator />
    <SelectLabel>Vegetables</SelectLabel>
    <SelectItem value="carrot">Carrot</SelectItem>
  </SelectContent>
</Select>
```

---

### Checkbox Component

**Location**: `src/components/ui/checkbox/Checkbox.tsx`

#### Features
- Framer Motion animations
- Controlled/uncontrolled modes
- Custom check mark animation

#### Usage Examples
```tsx
// Uncontrolled
<Checkbox defaultChecked />

// Controlled
<Checkbox checked={isChecked} onCheckedChange={setIsChecked} />

// With label
<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <label htmlFor="terms">Accept terms and conditions</label>
</div>
```

---

### ScrollArea Component

**Location**: `src/components/ui/scroll-areas/ScrollArea.tsx`

#### Props Interface
```typescript
interface ScrollAreaProps {
  flex?: boolean
  mask?: boolean
  orientation?: 'vertical' | 'horizontal'
  asChild?: boolean
  focusable?: boolean
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}
```

#### Usage Examples
```tsx
// Basic scroll area
<ScrollArea className="h-64">
  <div>Long content...</div>
</ScrollArea>

// Horizontal scrolling
<ScrollArea orientation="horizontal">
  <div className="flex space-x-4">
    {items.map(item => <div key={item.id}>{item.content}</div>)}
  </div>
</ScrollArea>

// With mask gradient
<ScrollArea mask className="h-96">
  <div>Content with fade edges</div>
</ScrollArea>
```

---

### Tooltip Component

**Location**: `src/components/ui/tooltip/Tooltip.tsx`

#### Features
- Context-based state management
- Directional entrance animations
- Auto-positioning
- Custom arrow support

#### Usage Examples
```tsx
// Basic tooltip
<Tooltip content="This is a tooltip">
  <Button>Hover me</Button>
</Tooltip>

// With custom trigger
<Tooltip content="Custom content">
  <span>Custom trigger</span>
</Tooltip>

// With arrow
<Tooltip content="Tooltip with arrow" showArrow>
  <Button>Hover for arrow</Button>
</Tooltip>
```

---

## Custom Hooks

### Theme Management

#### `useIsDark()`
Returns current dark mode state as boolean.

```typescript
const isDark = useIsDark() // boolean
```

#### `useThemeAtomValue()`
Returns current theme setting.

```typescript
const theme = useThemeAtomValue() // 'light' | 'dark' | 'system'
```

#### `useSetTheme()`
Returns theme setter function.

```typescript
const setTheme = useSetTheme()
setTheme('dark') // 'light' | 'dark' | 'system'
```

#### `useSyncThemeark()`
Syncs theme to DOM with transition prevention.

```typescript
useSyncThemeark() // Use in root component
```

---

### Controlled State

#### `useControlled<T>()`
Manages controlled/uncontrolled component state.

```typescript
const useControlled = <T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (v: T, ...args: any[]) => void,
): [T, (value: T) => void]

// Usage
const [inputValue, setInputValue] = useControlled(
  value,        // controlled value (optional)
  '',           // default value
  onChange      // change handler (optional)
)
```

---

### Viewport Management

#### `useViewport<T>()`
Responsive breakpoint detection with selectors.

```typescript
const useViewport = <T>(selector: (value: ViewportAtom) => T): T

// Usage examples
const isMobile = useViewport(v => !v.md)
const screenSize = useViewport(v => ({ width: v.w, height: v.h }))
const isDesktop = useViewport(v => v.lg)
```

#### Available Breakpoints
- `sm`: 640px and up
- `md`: 768px and up  
- `lg`: 1024px and up
- `xl`: 1280px and up
- `2xl`: 1536px and up
- `w`: Current window width
- `h`: Current window height

---

### Route Management

#### `useReadonlyRouteSelector<T>()`
Selects specific parts of route state.

```typescript
const useReadonlyRouteSelector = <T>(
  selector: (route: RouteAtom) => T,
  deps: any[] = []
): T

// Usage examples
const pathname = useReadonlyRouteSelector(route => route.location.pathname)
const searchTerm = useReadonlyRouteSelector(route => route.searchParams.get('q'))
const userId = useReadonlyRouteSelector(route => route.params.id)
```

---

## Utility Functions

### Class Name Utilities

#### `clsxm(...args)`
Merges class names with Tailwind class deduplication.

```typescript
const className = clsxm(
  'base-class',
  condition && 'conditional-class',
  { 'object-class': booleanCondition }
)
```

#### `cx(...args)`
Alternative class name merger (same functionality).

```typescript
const className = cx('class1', 'class2', { 'class3': condition })
```

### Design Tokens

#### Focus Styles
```typescript
// Input focus ring
const focusInput = [
  'focus:ring-2',
  'focus:ring-blue-200 dark:focus:ring-blue-700/30',
  'focus:border-blue-500 dark:focus:border-blue-700',
]

// General focus ring
const focusRing = [
  'outline outline-offset-2 outline-0 focus-visible:outline-2',
  'outline-blue-500 dark:outline-blue-500',
]

// Error state
const hasErrorInput = [
  'ring-2',
  'border-red-500 dark:border-red-700',
  'ring-red-700/30',
]
```

---

## State Management

### Jotai Integration

#### Creating Atom Hooks
```typescript
import { createAtomHooks } from '~/lib/jotai'

const myAtom = atom(initialValue)
const [
  atom,           // Original atom
  useMyAtom,      // Hook: [value, setValue]
  useMyAtomValue, // Hook: value only
  useSetMyAtom,   // Hook: setValue only
  getMyAtom,      // Direct getter
  setMyAtom       // Direct setter
] = createAtomHooks(myAtom)
```

#### Global Store Access
```typescript
import { jotaiStore } from '~/lib/jotai'

// Direct access without hooks
const value = jotaiStore.get(atom)
jotaiStore.set(atom, newValue)
```

---

## Color System

### Apple UIKit Colors

#### System Colors
- `red`, `orange`, `yellow`, `green`, `mint`, `teal`, `cyan`
- `blue`, `indigo`, `purple`, `pink`, `brown`, `gray`

#### Fill Colors  
- `fill`, `fill-secondary`, `fill-tertiary`, `fill-quaternary`, `fill-quinary`
- `fill-vibrant`, `fill-vibrant-secondary`, etc.

#### Text Colors
- `text`, `text-secondary`, `text-tertiary`, `text-quaternary`, `text-quinary`
- `text-vibrant`, `text-vibrant-secondary`, etc.

#### Material Colors
- `material-ultra-thick`, `material-thick`, `material-medium`
- `material-thin`, `material-ultra-thin`, `material-opaque`

#### Usage Examples
```tsx
// System colors
<div className="bg-blue text-white">Blue background</div>
<div className="text-red">Red text</div>

// Fill colors
<div className="bg-fill">Primary fill</div>
<div className="bg-fill-secondary">Secondary fill</div>

// Material colors
<div className="bg-material-thick">Thick material</div>
```

Note: These colors automatically adapt to light/dark mode based on system preferences.