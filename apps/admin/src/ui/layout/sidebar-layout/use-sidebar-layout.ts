import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect } from 'react'

import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from '~/constants/layout'

import { effectiveSidebarWidthAtom, sidebarCollapsedAtom } from './atoms'

function clampWidth(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw))
    return SIDEBAR_WIDTH_DEFAULT
  if (raw < SIDEBAR_WIDTH_MIN) return SIDEBAR_WIDTH_MIN
  if (raw > SIDEBAR_WIDTH_MAX) return SIDEBAR_WIDTH_MAX
  return raw
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  // jsdom fallback — isContentEditable can be unreliable
  const ce = el.getAttribute('contenteditable')
  if (ce === '' || ce === 'true' || ce === 'plaintext-only') return true
  return false
}

export interface SidebarLayoutApi {
  collapsed: boolean
  widthPx: number
  toggle: () => void
  setCollapsed: (next: boolean) => void
}

export function useSidebarLayout(): SidebarLayoutApi {
  const [collapsed, setCollapsedAtom] = useAtom(sidebarCollapsedAtom)
  const rawWidth = useAtomValue(effectiveSidebarWidthAtom)
  const widthPx = clampWidth(rawWidth)
  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedAtom(next)
    },
    [setCollapsedAtom],
  )
  const toggle = useCallback(() => {
    setCollapsedAtom((prev) => !prev)
  }, [setCollapsedAtom])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'b' && e.key !== 'B') return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.shiftKey || e.altKey) return
      if (isEditableTarget(document.activeElement)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  return { collapsed, setCollapsed, toggle, widthPx }
}
