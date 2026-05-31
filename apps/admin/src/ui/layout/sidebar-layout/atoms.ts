import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '~/constants/layout'

// getOnInit: true → synchronously read localStorage on first get, so the very
// first React render already reflects the persisted value. Without this, the
// atom hands back the initialValue on render #1 and the storage value on
// render #2, which causes a visible flash + spurious grid-template-columns
// transition on page refresh.
export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  false,
  undefined,
  { getOnInit: true },
)

// Persisted "restore" width — only committed on pointer-up when the drag ended
// in an expanded state. Drag-to-collapse must NOT pollute this value, otherwise
// the next expand opens at the partial in-flight width (MIN, in our case).
export const sidebarWidthAtom = atomWithStorage<number>(
  SIDEBAR_WIDTH_STORAGE_KEY,
  SIDEBAR_WIDTH_DEFAULT,
  undefined,
  { getOnInit: true },
)

// Live UI width override — set during an active drag, drives layout in-flight.
// null means "no override active; the effective width is the persisted value".
export const sidebarLiveWidthAtom = atom<number | null>(null)

// Effective width = live override if set, else persisted restore width.
export const effectiveSidebarWidthAtom = atom((get) => {
  const live = get(sidebarLiveWidthAtom)
  if (live != null) return live
  return get(sidebarWidthAtom)
})
