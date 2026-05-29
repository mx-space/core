import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import type { EditorView } from '@codemirror/view'
import type { SlashMenuGroup, SlashMenuItemWithGroup } from './slash-menu-items'

import {
  closeSlashMenuEffect,
  slashMenuCommandAnnotation,
  slashMenuStateField,
} from './slash-menu-extension'
import { slashMenuGroups, slashMenuItems } from './slash-menu-items'

interface SlashMenuPosition {
  x: number
  y: number
}

const findScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
  while (el) {
    const style = getComputedStyle(el)
    const overflowY = style.overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    ) {
      return el
    }
    el = el.parentElement
  }
  return null
}

interface SyncSnapshot {
  isOpen: boolean
  position: SlashMenuPosition | null
  query: string
}

const INITIAL_SNAPSHOT: SyncSnapshot = {
  isOpen: false,
  position: null,
  query: '',
}

export function useSlashMenu(editorView: EditorView | undefined) {
  const [{ isOpen, position, query }, setSnapshot] =
    useState<SyncSnapshot>(INITIAL_SNAPSHOT)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isKeyboardNav, setIsKeyboardNav] = useState(false)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const stateRef = useRef<SyncSnapshot>(INITIAL_SNAPSHOT)
  stateRef.current = { isOpen, position, query }

  const fuse = useMemo(
    () =>
      new Fuse(slashMenuItems, {
        keys: ['label', 'description', 'keywords'],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1,
      }),
    [],
  )

  const filteredItems = useMemo<SlashMenuItemWithGroup[]>(() => {
    const q = query.trim()
    if (!q) return slashMenuItems
    return fuse.search(q).map((r) => r.item)
  }, [fuse, query])

  const groupedItems = useMemo<
    Array<Omit<SlashMenuGroup, 'items'> & { items: SlashMenuItemWithGroup[] }>
  >(() => {
    const available = new Map<string, SlashMenuItemWithGroup[]>()
    for (const item of filteredItems) {
      const list = available.get(item.groupId) ?? []
      list.push(item)
      available.set(item.groupId, list)
    }
    return slashMenuGroups
      .map((group) => ({
        ...group,
        items: available.get(group.id) ?? [],
      }))
      .filter((group) => group.items.length > 0)
  }, [filteredItems])

  const flatItems = filteredItems

  const syncFromEditor = useCallback(() => {
    const view = editorView
    if (!view) {
      setSnapshot(INITIAL_SNAPSHOT)
      return
    }

    const state = view.state.field(slashMenuStateField, false)
    if (!state?.active || state.triggerPos == null) {
      setSnapshot({ isOpen: false, position: null, query: state?.query ?? '' })
      return
    }

    const coords = view.coordsAtPos(state.triggerPos)
    if (!coords) {
      setSnapshot({ isOpen: false, position: null, query: state.query })
      return
    }

    const scroller = scrollerRef.current ?? view.scrollDOM
    const scrollerRect = scroller.getBoundingClientRect()
    if (coords.bottom < scrollerRect.top || coords.top > scrollerRect.bottom) {
      setSnapshot({ isOpen: false, position: null, query: state.query })
      return
    }

    setSnapshot({
      isOpen: true,
      position: { x: coords.left, y: coords.bottom + 4 },
      query: state.query,
    })
  }, [editorView])

  const closeMenu = useCallback(() => {
    const view = editorView
    if (!view) return
    view.dispatch({
      effects: closeSlashMenuEffect.of(undefined),
      annotations: slashMenuCommandAnnotation.of(true),
    })
    syncFromEditor()
  }, [editorView, syncFromEditor])

  const executeItem = useCallback(
    (item: SlashMenuItemWithGroup) => {
      const view = editorView
      if (!view) return
      const state = view.state.field(slashMenuStateField, false)
      if (!state?.active || state.triggerPos == null) return

      const head = view.state.selection.main.head
      view.dispatch({
        changes: { from: state.triggerPos, to: head, insert: '' },
        selection: { anchor: state.triggerPos },
        annotations: slashMenuCommandAnnotation.of(true),
      })

      item.command(view)
      closeMenu()
      view.focus()
    },
    [editorView, closeMenu],
  )

  const selectActiveItem = useCallback(() => {
    const items = flatItems
    if (items.length === 0) return
    const index = Math.min(activeIndex, items.length - 1)
    executeItem(items[index])
  }, [activeIndex, flatItems, executeItem])

  const moveActive = useCallback(
    (delta: number) => {
      const items = flatItems
      if (items.length === 0) return
      const total = items.length
      setIsKeyboardNav(true)
      setActiveIndex((prev) => (prev + delta + total) % total)
    },
    [flatItems],
  )

  useEffect(() => {
    if (!isOpen || flatItems.length === 0) {
      setActiveIndex(0)
      return
    }
    if (activeIndex >= flatItems.length) setActiveIndex(0)
  }, [isOpen, flatItems, activeIndex])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const view = editorView
    if (!view) return

    const handleInput = () => syncFromEditor()
    const handleKeydown = (event: KeyboardEvent) => {
      if (!stateRef.current.isOpen) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        moveActive(1)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        moveActive(-1)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        selectActiveItem()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMenu()
      }
    }

    const handleScroll = () => {
      if (stateRef.current.isOpen) syncFromEditor()
    }

    const scroller = findScrollableParent(view.dom) ?? view.scrollDOM
    scrollerRef.current = scroller

    view.dom.addEventListener('input', handleInput)
    view.dom.addEventListener('keyup', handleInput)
    view.dom.addEventListener('mouseup', handleInput)
    view.dom.addEventListener('compositionend', handleInput)
    view.dom.addEventListener('keydown', handleKeydown, { capture: true })
    scroller.addEventListener('scroll', handleScroll, { passive: true })

    syncFromEditor()

    return () => {
      view.dom.removeEventListener('input', handleInput)
      view.dom.removeEventListener('keyup', handleInput)
      view.dom.removeEventListener('mouseup', handleInput)
      view.dom.removeEventListener('compositionend', handleInput)
      view.dom.removeEventListener('keydown', handleKeydown, {
        capture: true,
      } as EventListenerOptions)
      scroller.removeEventListener('scroll', handleScroll)
    }
  }, [editorView, moveActive, selectActiveItem, closeMenu, syncFromEditor])

  return {
    isOpen,
    position,
    query,
    groupedItems,
    flatItems,
    activeIndex,
    isKeyboardNav,
    setActiveIndex,
    setIsKeyboardNav,
    moveActive,
    executeItem,
    selectActiveItem,
    closeMenu,
    syncFromEditor,
  }
}
