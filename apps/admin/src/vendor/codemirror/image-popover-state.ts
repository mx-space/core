import { atom, getDefaultStore, useAtomValue } from 'jotai'
import type { EditorView } from '@codemirror/view'

export interface ImagePopoverSnapshot {
  visible: boolean
  targetEl: HTMLElement | null
  view: EditorView | null
}

const emptySnapshot: ImagePopoverSnapshot = {
  visible: false,
  targetEl: null,
  view: null,
}

const imagePopoverAtom = atom<ImagePopoverSnapshot>(emptySnapshot)
const jotaiStore = getDefaultStore()

export function getImagePopoverState(): ImagePopoverSnapshot {
  return jotaiStore.get(imagePopoverAtom)
}

export function useImagePopoverState(): ImagePopoverSnapshot {
  return useAtomValue(imagePopoverAtom)
}

export const showImagePopover = (
  targetEl: HTMLElement,
  view: EditorView,
): void => {
  jotaiStore.set(imagePopoverAtom, { visible: true, targetEl, view })
}

export const hideImagePopover = (): void => {
  jotaiStore.set(imagePopoverAtom, emptySnapshot)
}
