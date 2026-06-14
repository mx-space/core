import { Dialog } from '@base-ui/react/dialog'
import * as React from 'react'

import { commandScore } from './command-score'

type Children = { children?: React.ReactNode }
type DivProps = React.HTMLAttributes<HTMLDivElement>

type LoadingProps = Children &
  DivProps & {
    progress?: number
    label?: string
  }

type EmptyProps = Children & DivProps

type SeparatorProps = DivProps & {
  alwaysRender?: boolean
}

type DialogProps = Children &
  CommandProps & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    overlayClassName?: string
    contentClassName?: string
    container?: HTMLElement
  }

type ListProps = Children &
  DivProps & {
    label?: string
  }

type ItemProps = Children &
  Omit<DivProps, 'onSelect' | 'value'> & {
    disabled?: boolean
    onSelect?: (value: string) => void
    value?: string
    keywords?: string[]
    forceMount?: boolean
  }

type GroupProps = Children &
  Omit<DivProps, 'heading' | 'value'> & {
    heading?: React.ReactNode
    value?: string
    forceMount?: boolean
  }

type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value?: string
  onValueChange?: (search: string) => void
}

type CommandFilter = (
  value: string,
  search: string,
  keywords?: string[],
) => number

type CommandProps = Children &
  DivProps & {
    label?: string
    shouldFilter?: boolean
    filter?: CommandFilter
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
    loop?: boolean
    disablePointerSelection?: boolean
    vimBindings?: boolean
  }

interface ContextValue {
  value: (id: string, value: string, keywords?: string[]) => void
  item: (id: string, groupId?: string) => () => void
  group: (id: string) => () => void
  filter: () => boolean
  label: string
  getDisablePointerSelection: () => boolean
  listId: string
  labelId: string
  inputId: string
  listInnerRef: React.RefObject<HTMLDivElement | null>
}

interface State {
  search: string
  value: string
  selectedItemId?: string
  filtered: {
    count: number
    items: Map<string, number>
    groups: Set<string>
  }
}

interface Store {
  subscribe: (callback: () => void) => () => void
  snapshot: () => State
  setState: <K extends keyof State>(
    key: K,
    value: State[K],
    opts?: boolean,
  ) => void
  emit: () => void
}

interface GroupContextValue {
  id: string
  forceMount?: boolean
}

const GROUP_SELECTOR = '[cmdk-group=""]'
const GROUP_ITEMS_SELECTOR = '[cmdk-group-items=""]'
const GROUP_HEADING_SELECTOR = '[cmdk-group-heading=""]'
const ITEM_SELECTOR = '[cmdk-item=""]'
const VALID_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([aria-disabled="true"])`
const SELECT_EVENT = 'cmdk-item-select'
const VALUE_ATTR = 'data-value'

const defaultFilter: CommandFilter = (value, search, keywords) =>
  commandScore(value, search, keywords)

const CommandContext = React.createContext<ContextValue | null>(null)
const useCommand = (): ContextValue => {
  const ctx = React.useContext(CommandContext)
  if (!ctx) throw new Error('Command components must be used inside <Command>')
  return ctx
}

const StoreContext = React.createContext<Store | null>(null)
const useStore = (): Store => {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error('Command components must be used inside <Command>')
  return ctx
}

const GroupContext = React.createContext<GroupContextValue | null>(null)

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

const CommandRoot = React.forwardRef<HTMLDivElement, CommandProps>(
  (props, forwardedRef) => {
    const state = useLazyRef<State>(() => ({
      search: '',
      value: props.value ?? props.defaultValue ?? '',
      selectedItemId: undefined,
      filtered: {
        count: 0,
        items: new Map(),
        groups: new Set(),
      },
    }))
    const allItems = useLazyRef<Set<string>>(() => new Set())
    const allGroups = useLazyRef<Map<string, Set<string>>>(() => new Map())
    const ids = useLazyRef<Map<string, { value: string; keywords?: string[] }>>(
      () => new Map(),
    )
    const listeners = useLazyRef<Set<() => void>>(() => new Set())
    const propsRef = useAsRef(props)
    const {
      label,
      children,
      value,
      onValueChange: _onValueChange,
      filter: _filter,
      shouldFilter: _shouldFilter,
      loop: _loop,
      defaultValue: _defaultValue,
      disablePointerSelection: _disablePointerSelection = false,
      vimBindings = true,
      ...etc
    } = props

    const listId = React.useId()
    const labelId = React.useId()
    const inputId = React.useId()

    const listInnerRef = React.useRef<HTMLDivElement>(null)

    const schedule = useScheduleLayoutEffect()

    useIsomorphicLayoutEffect(() => {
      if (value !== undefined) {
        const v = value.trim()
        state.current.value = v
        store.emit()
      }
    }, [value])

    useIsomorphicLayoutEffect(() => {
      schedule(6, scrollSelectedIntoView)
    }, [])

    const store: Store = React.useMemo(() => {
      return {
        subscribe: (cb) => {
          listeners.current.add(cb)
          return () => {
            listeners.current.delete(cb)
          }
        },
        snapshot: () => state.current,
        setState: (key, val, opts) => {
          if (Object.is(state.current[key], val)) return
          state.current[key] = val

          if (key === 'search') {
            filterItems()
            sort()
            schedule(1, selectFirstItem)
          } else if (key === 'value') {
            const active = document.activeElement
            if (
              active?.hasAttribute('cmdk-input') ||
              active?.hasAttribute('cmdk-root')
            ) {
              const input = document.getElementById(inputId)
              if (input) input.focus()
              else document.getElementById(listId)?.focus()
            }

            schedule(7, () => {
              state.current.selectedItemId = getSelectedItem()?.id
              store.emit()
            })

            if (!opts) {
              schedule(5, scrollSelectedIntoView)
            }
            if (propsRef.current?.value !== undefined) {
              const newValue = ((val as string) ?? '') as string
              propsRef.current.onValueChange?.(newValue)
              return
            }
          }

          store.emit()
        },
        emit: () => {
          listeners.current.forEach((l) => l())
        },
      }
    }, [])

    const context: ContextValue = React.useMemo(
      () => ({
        value: (id, val, keywords) => {
          if (val !== ids.current.get(id)?.value) {
            ids.current.set(id, { value: val, keywords })
            state.current.filtered.items.set(id, score(val, keywords))
            schedule(2, () => {
              sort()
              store.emit()
            })
          }
        },
        item: (id, groupId) => {
          allItems.current.add(id)

          if (groupId) {
            if (!allGroups.current.has(groupId)) {
              allGroups.current.set(groupId, new Set([id]))
            } else {
              allGroups.current.get(groupId)!.add(id)
            }
          }

          schedule(3, () => {
            filterItems()
            sort()

            if (!state.current.value) {
              selectFirstItem()
            }

            store.emit()
          })

          return () => {
            ids.current.delete(id)
            allItems.current.delete(id)
            state.current.filtered.items.delete(id)
            const selectedItem = getSelectedItem()

            schedule(4, () => {
              filterItems()

              if (selectedItem?.getAttribute('id') === id) selectFirstItem()

              store.emit()
            })
          }
        },
        group: (id) => {
          if (!allGroups.current.has(id)) {
            allGroups.current.set(id, new Set())
          }

          return () => {
            ids.current.delete(id)
            allGroups.current.delete(id)
          }
        },
        filter: () => propsRef.current.shouldFilter !== false,
        label: label ?? (props['aria-label'] as string) ?? '',
        getDisablePointerSelection: () =>
          propsRef.current.disablePointerSelection ?? false,
        listId,
        inputId,
        labelId,
        listInnerRef,
      }),
      [],
    )

    function score(val: string, keywords?: string[]): number {
      const filter = propsRef.current?.filter ?? defaultFilter
      return val ? filter(val, state.current.search, keywords) : 0
    }

    function sort() {
      if (!state.current.search || propsRef.current.shouldFilter === false) {
        return
      }

      const scores = state.current.filtered.items

      const groups: [string, number][] = []
      state.current.filtered.groups.forEach((val) => {
        const items = allGroups.current.get(val)
        if (!items) return

        let max = 0
        items.forEach((item) => {
          const s = scores.get(item) ?? 0
          max = Math.max(s, max)
        })

        groups.push([val, max])
      })

      const listInsertionElement = listInnerRef.current
      if (!listInsertionElement) return

      getValidItems()
        .sort((a, b) => {
          const valueA = a.getAttribute('id') ?? ''
          const valueB = b.getAttribute('id') ?? ''
          return (scores.get(valueB) ?? 0) - (scores.get(valueA) ?? 0)
        })
        .forEach((item) => {
          const group = item.closest(GROUP_ITEMS_SELECTOR)

          if (group) {
            const child =
              item.parentElement === group
                ? item
                : item.closest(`${GROUP_ITEMS_SELECTOR} > *`)
            if (child) group.appendChild(child)
          } else {
            const child =
              item.parentElement === listInsertionElement
                ? item
                : item.closest(`${GROUP_ITEMS_SELECTOR} > *`)
            if (child) listInsertionElement.appendChild(child)
          }
        })

      groups
        .sort((a, b) => b[1] - a[1])
        .forEach(([groupValue]) => {
          const element = listInnerRef.current?.querySelector(
            `${GROUP_SELECTOR}[${VALUE_ATTR}="${encodeURIComponent(groupValue)}"]`,
          )
          element?.parentElement?.appendChild(element)
        })
    }

    function selectFirstItem() {
      const item = getValidItems().find(
        (item) => item.getAttribute('aria-disabled') !== 'true',
      )
      const val = item?.getAttribute(VALUE_ATTR)
      store.setState('value', val ?? '')
    }

    function filterItems() {
      if (!state.current.search || propsRef.current.shouldFilter === false) {
        state.current.filtered.count = allItems.current.size
        return
      }

      state.current.filtered.groups = new Set()
      let itemCount = 0

      for (const id of allItems.current) {
        const val = ids.current.get(id)?.value ?? ''
        const keywords = ids.current.get(id)?.keywords ?? []
        const rank = score(val, keywords)
        state.current.filtered.items.set(id, rank)
        if (rank > 0) itemCount++
      }

      for (const [groupId, group] of allGroups.current) {
        for (const itemId of group) {
          if ((state.current.filtered.items.get(itemId) ?? 0) > 0) {
            state.current.filtered.groups.add(groupId)
            break
          }
        }
      }

      state.current.filtered.count = itemCount
    }

    function scrollSelectedIntoView() {
      const item = getSelectedItem()

      if (item) {
        if (item.parentElement?.firstChild === item) {
          item
            .closest(GROUP_SELECTOR)
            ?.querySelector(GROUP_HEADING_SELECTOR)
            ?.scrollIntoView({ block: 'nearest' })
        }

        item.scrollIntoView({ block: 'nearest' })
      }
    }

    function getSelectedItem(): HTMLElement | null {
      return (
        listInnerRef.current?.querySelector<HTMLElement>(
          `${ITEM_SELECTOR}[aria-selected="true"]`,
        ) ?? null
      )
    }

    function getValidItems(): HTMLElement[] {
      return Array.from(
        listInnerRef.current?.querySelectorAll<HTMLElement>(
          VALID_ITEM_SELECTOR,
        ) ?? [],
      )
    }

    function updateSelectedToIndex(index: number) {
      const items = getValidItems()
      const item = items[index]
      if (item) store.setState('value', item.getAttribute(VALUE_ATTR) ?? '')
    }

    function updateSelectedByItem(change: 1 | -1) {
      const selected = getSelectedItem()
      const items = getValidItems()
      const index = items.indexOf(selected)

      let newSelected = items[index + change] as HTMLElement | undefined

      if (propsRef.current?.loop) {
        newSelected =
          index + change < 0
            ? items.at(-1)
            : index + change === items.length
              ? items[0]
              : items[index + change]
      }

      if (newSelected) {
        store.setState('value', newSelected.getAttribute(VALUE_ATTR) ?? '')
      }
    }

    function updateSelectedByGroup(change: 1 | -1) {
      const selected = getSelectedItem()
      let group = selected?.closest<HTMLElement>(GROUP_SELECTOR) ?? null
      let item: HTMLElement | null = null

      while (group && !item) {
        group =
          change > 0
            ? (findNextSibling(group, GROUP_SELECTOR) as HTMLElement | null)
            : (findPreviousSibling(group, GROUP_SELECTOR) as HTMLElement | null)
        item = group?.querySelector<HTMLElement>(VALID_ITEM_SELECTOR) ?? null
      }

      if (item) {
        store.setState('value', item.getAttribute(VALUE_ATTR) ?? '')
      } else {
        updateSelectedByItem(change)
      }
    }

    const last = () => updateSelectedToIndex(getValidItems().length - 1)

    const next = (e: React.KeyboardEvent) => {
      e.preventDefault()
      if (e.metaKey) last()
      else if (e.altKey) updateSelectedByGroup(1)
      else updateSelectedByItem(1)
    }

    const prev = (e: React.KeyboardEvent) => {
      e.preventDefault()
      if (e.metaKey) updateSelectedToIndex(0)
      else if (e.altKey) updateSelectedByGroup(-1)
      else updateSelectedByItem(-1)
    }

    return (
      <div
        ref={forwardedRef}
        tabIndex={-1}
        {...etc}
        cmdk-root=""
        onKeyDown={(e) => {
          etc.onKeyDown?.(e)

          const isComposing =
            (e.nativeEvent as KeyboardEvent).isComposing ||
            (e.nativeEvent as KeyboardEvent).keyCode === 229

          if (e.defaultPrevented || isComposing) return

          switch (e.key) {
            case 'n':
            case 'j': {
              if (vimBindings && e.ctrlKey) next(e)
              break
            }
            case 'ArrowDown': {
              next(e)
              break
            }
            case 'p':
            case 'k': {
              if (vimBindings && e.ctrlKey) prev(e)
              break
            }
            case 'ArrowUp': {
              prev(e)
              break
            }
            case 'Home': {
              e.preventDefault()
              updateSelectedToIndex(0)
              break
            }
            case 'End': {
              e.preventDefault()
              last()
              break
            }
            case 'Enter': {
              e.preventDefault()
              const item = getSelectedItem()
              if (item) {
                const event = new Event(SELECT_EVENT)
                item.dispatchEvent(event)
              }
            }
          }
        }}
      >
        <label
          cmdk-label=""
          htmlFor={context.inputId}
          id={context.labelId}
          style={srOnlyStyles}
        >
          {label}
        </label>
        <StoreContext.Provider value={store}>
          <CommandContext.Provider value={context}>
            {children}
          </CommandContext.Provider>
        </StoreContext.Provider>
      </div>
    )
  },
)
CommandRoot.displayName = 'Command'

const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  (props, forwardedRef) => {
    const id = React.useId()
    const ref = React.useRef<HTMLDivElement>(null)
    const groupContext = React.useContext(GroupContext)
    const context = useCommand()
    const propsRef = useAsRef(props)
    const forceMount = propsRef.current?.forceMount ?? groupContext?.forceMount

    useIsomorphicLayoutEffect(() => {
      if (!forceMount) {
        return context.item(id, groupContext?.id)
      }
    }, [forceMount])

    const value = useValue(
      id,
      ref,
      [props.value, props.children, ref],
      props.keywords,
    )

    const store = useStore()
    const selected = useCmdk(
      (state) => state.value && state.value === value.current,
    )
    const render = useCmdk((state) =>
      forceMount
        ? true
        : context.filter() === false
          ? true
          : !state.search
            ? true
            : (state.filtered.items.get(id) ?? 0) > 0,
    )

    React.useEffect(() => {
      const element = ref.current
      if (!element || props.disabled) return
      element.addEventListener(SELECT_EVENT, onSelect)
      return () => element.removeEventListener(SELECT_EVENT, onSelect)
    }, [render, props.onSelect, props.disabled])

    function onSelect() {
      select()
      propsRef.current.onSelect?.(value.current ?? '')
    }

    function select() {
      store.setState('value', value.current ?? '', true)
    }

    if (!render) return null

    const {
      disabled,
      value: _value,
      onSelect: _onSelect,
      forceMount: _forceMount,
      keywords: _keywords,
      ...etc
    } = props

    return (
      <div
        ref={composeRefs(ref, forwardedRef)}
        {...etc}
        id={id}
        cmdk-item=""
        role="option"
        aria-disabled={Boolean(disabled)}
        aria-selected={Boolean(selected)}
        data-disabled={Boolean(disabled)}
        data-selected={Boolean(selected)}
        onPointerMove={
          disabled || context.getDisablePointerSelection() ? undefined : select
        }
        onClick={disabled ? undefined : onSelect}
      >
        {props.children}
      </div>
    )
  },
)
Item.displayName = 'CommandItem'

const Group = React.forwardRef<HTMLDivElement, GroupProps>(
  (props, forwardedRef) => {
    const { heading, children, forceMount, ...etc } = props
    const id = React.useId()
    const ref = React.useRef<HTMLDivElement>(null)
    const headingRef = React.useRef<HTMLDivElement>(null)
    const headingId = React.useId()
    const context = useCommand()
    const render = useCmdk((state) =>
      forceMount
        ? true
        : context.filter() === false
          ? true
          : !state.search
            ? true
            : state.filtered.groups.has(id),
    )

    useIsomorphicLayoutEffect(() => context.group(id), [])

    useValue(id, ref, [props.value, props.heading, headingRef])

    const contextValue = React.useMemo(() => ({ id, forceMount }), [forceMount])

    return (
      <div
        ref={composeRefs(ref, forwardedRef)}
        {...etc}
        cmdk-group=""
        role="presentation"
        hidden={render ? undefined : true}
      >
        {heading ? (
          <div
            ref={headingRef}
            cmdk-group-heading=""
            aria-hidden
            id={headingId}
          >
            {heading}
          </div>
        ) : null}
        <div
          cmdk-group-items=""
          role="group"
          aria-labelledby={heading ? headingId : undefined}
        >
          <GroupContext.Provider value={contextValue}>
            {children}
          </GroupContext.Provider>
        </div>
      </div>
    )
  },
)
Group.displayName = 'CommandGroup'

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (props, forwardedRef) => {
    const { alwaysRender, ...etc } = props
    const ref = React.useRef<HTMLDivElement>(null)
    const render = useCmdk((state) => !state.search)

    if (!alwaysRender && !render) return null
    return (
      <div
        ref={composeRefs(ref, forwardedRef)}
        {...etc}
        cmdk-separator=""
        role="separator"
      />
    )
  },
)
Separator.displayName = 'CommandSeparator'

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props, forwardedRef) => {
    const { onValueChange, ...etc } = props
    const isControlled = props.value != null
    const store = useStore()
    const search = useCmdk((state) => state.search)
    const selectedItemId = useCmdk((state) => state.selectedItemId)
    const context = useCommand()

    React.useEffect(() => {
      if (props.value != null) {
        store.setState('search', props.value)
      }
    }, [props.value])

    return (
      <input
        ref={forwardedRef}
        {...etc}
        cmdk-input=""
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        role="combobox"
        aria-expanded={true}
        aria-controls={context.listId}
        aria-labelledby={context.labelId}
        aria-activedescendant={selectedItemId}
        id={context.inputId}
        type="text"
        value={isControlled ? props.value : search}
        onChange={(e) => {
          if (!isControlled) {
            store.setState('search', e.target.value)
          }
          onValueChange?.(e.target.value)
        }}
      />
    )
  },
)
Input.displayName = 'CommandInput'

const List = React.forwardRef<HTMLDivElement, ListProps>(
  (props, forwardedRef) => {
    const { children, label = 'Suggestions', ...etc } = props
    const ref = React.useRef<HTMLDivElement>(null)
    const height = React.useRef<HTMLDivElement>(null)
    const selectedItemId = useCmdk((state) => state.selectedItemId)
    const context = useCommand()

    React.useEffect(() => {
      if (height.current && ref.current) {
        const el = height.current
        const wrapper = ref.current
        let animationFrame: number | undefined
        const observer = new ResizeObserver(() => {
          animationFrame = requestAnimationFrame(() => {
            const h = el.offsetHeight
            wrapper.style.setProperty('--cmdk-list-height', `${h.toFixed(1)}px`)
          })
        })
        observer.observe(el)
        return () => {
          if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
          observer.unobserve(el)
        }
      }
    }, [])

    return (
      <div
        ref={composeRefs(ref, forwardedRef)}
        {...etc}
        cmdk-list=""
        role="listbox"
        tabIndex={-1}
        aria-activedescendant={selectedItemId}
        aria-label={label}
        id={context.listId}
      >
        <div ref={composeRefs(height, context.listInnerRef)} cmdk-list-sizer="">
          {children}
        </div>
      </div>
    )
  },
)
List.displayName = 'CommandList'

const CommandDialog = React.forwardRef<HTMLDivElement, DialogProps>(
  (props, forwardedRef) => {
    const {
      open,
      onOpenChange,
      overlayClassName,
      contentClassName,
      container,
      children,
      ...etc
    } = props
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal container={container}>
          <Dialog.Backdrop cmdk-overlay="" className={overlayClassName} />
          <Dialog.Popup
            aria-label={props.label}
            cmdk-dialog=""
            className={contentClassName}
          >
            <CommandRoot ref={forwardedRef} {...etc}>
              {children}
            </CommandRoot>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    )
  },
)
CommandDialog.displayName = 'CommandDialog'

const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(
  (props, forwardedRef) => {
    const render = useCmdk((state) => state.filtered.count === 0)

    if (!render) return null
    return (
      <div ref={forwardedRef} {...props} cmdk-empty="" role="presentation" />
    )
  },
)
Empty.displayName = 'CommandEmpty'

const Loading = React.forwardRef<HTMLDivElement, LoadingProps>(
  (props, forwardedRef) => {
    const { progress, children, label = 'Loading...', ...etc } = props

    return (
      <div
        ref={forwardedRef}
        {...etc}
        cmdk-loading=""
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div aria-hidden>{children}</div>
      </div>
    )
  },
)
Loading.displayName = 'CommandLoading'

export const Command = Object.assign(CommandRoot, {
  List,
  Item,
  Input,
  Group,
  Separator,
  Dialog: CommandDialog,
  Empty,
  Loading,
})

export { useCmdk as useCommandState }
export { defaultFilter }

export {
  CommandDialog,
  Empty as CommandEmpty,
  Group as CommandGroup,
  Input as CommandInput,
  Item as CommandItem,
  List as CommandList,
  Loading as CommandLoading,
  CommandRoot,
  Separator as CommandSeparator,
}

function findNextSibling(el: Element, selector: string): Element | null {
  let sibling = el.nextElementSibling
  while (sibling) {
    if (sibling.matches(selector)) return sibling
    sibling = sibling.nextElementSibling
  }
  return null
}

function findPreviousSibling(el: Element, selector: string): Element | null {
  let sibling = el.previousElementSibling
  while (sibling) {
    if (sibling.matches(selector)) return sibling
    sibling = sibling.previousElementSibling
  }
  return null
}

function useAsRef<T>(data: T): React.MutableRefObject<T> {
  const ref = React.useRef<T>(data)
  useIsomorphicLayoutEffect(() => {
    ref.current = data
  })
  return ref
}

function useLazyRef<T>(fn: () => T): React.MutableRefObject<T> {
  const ref = React.useRef<T | undefined>(undefined)
  if (ref.current === undefined) {
    ref.current = fn()
  }
  return ref as React.MutableRefObject<T>
}

function useCmdk<T>(selector: (state: State) => T): T {
  const store = useStore()
  const cb = React.useCallback(() => selector(store.snapshot()), [store])
  return React.useSyncExternalStore(store.subscribe, cb, cb)
}

function useValue(
  id: string,
  ref: React.RefObject<HTMLElement | null>,
  deps: Array<string | React.ReactNode | React.RefObject<HTMLElement | null>>,
  aliases: string[] = [],
): React.MutableRefObject<string | undefined> {
  const valueRef = React.useRef<string | undefined>(undefined)
  const context = useCommand()

  useIsomorphicLayoutEffect(() => {
    const value = (() => {
      for (const part of deps) {
        if (typeof part === 'string') return part.trim()
        if (typeof part === 'object' && part !== null && 'current' in part) {
          if (part.current) return part.current.textContent?.trim()
          return valueRef.current
        }
      }
      return undefined
    })()

    const keywords = aliases.map((alias) => alias.trim())

    context.value(id, value ?? '', keywords)
    ref.current?.setAttribute(VALUE_ATTR, value ?? '')
    valueRef.current = value
  })

  return valueRef
}

const useScheduleLayoutEffect = () => {
  const [s, ss] = React.useState<object>()
  const fns = useLazyRef(() => new Map<string | number, () => void>())

  useIsomorphicLayoutEffect(() => {
    fns.current.forEach((f) => f())
    fns.current = new Map()
  }, [s])

  return (id: string | number, cb: () => void) => {
    fns.current.set(id, cb)
    ss({})
  }
}

function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value)
      else if (ref != null)
        (ref as React.MutableRefObject<T | null>).current = value
    }
  }
}

const srOnlyStyles: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
}
