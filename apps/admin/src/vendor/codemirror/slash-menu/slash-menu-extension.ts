import { Annotation, StateEffect, StateField } from '@codemirror/state'

import { isLineInBlock } from '../wysiwyg'

export interface SlashMenuState {
  active: boolean
  triggerPos: number | null
  query: string
}

const emptyState: SlashMenuState = {
  active: false,
  triggerPos: null,
  query: '',
}

export const openSlashMenuEffect = StateEffect.define<{ triggerPos: number }>()
export const closeSlashMenuEffect = StateEffect.define<void>()
export const updateSlashMenuQueryEffect = StateEffect.define<string>()

export const slashMenuCommandAnnotation = Annotation.define<boolean>()

const shouldClose = (): SlashMenuState => ({ ...emptyState })

export const slashMenuStateField = StateField.define<SlashMenuState>({
  create() {
    return emptyState
  },
  update(value, tr) {
    if (tr.annotation(slashMenuCommandAnnotation)) {
      return emptyState
    }

    let next = value
    for (const effect of tr.effects) {
      if (effect.is(openSlashMenuEffect)) {
        next = {
          active: true,
          triggerPos: effect.value.triggerPos,
          query: '',
        }
      }
      if (effect.is(closeSlashMenuEffect)) {
        next = emptyState
      }
      if (effect.is(updateSlashMenuQueryEffect)) {
        if (next.active) {
          next = { ...next, query: effect.value }
        }
      }
    }

    if (!next.active) {
      if (!tr.docChanged || !tr.isUserEvent('input')) {
        return next
      }

      const selection = tr.newSelection.main
      if (!selection.empty) return next

      let slashPos: number | null = null
      tr.changes.iterChanges((_fromA, _toA, fromB, _toB, inserted) => {
        if (slashPos != null) return
        const text = inserted.toString()
        const index = text.lastIndexOf('/')
        if (index === -1) return
        slashPos = fromB + index
      })

      if (slashPos == null) return next

      if (selection.head !== slashPos + 1) return next

      const doc = tr.newDoc
      if (doc.sliceString(slashPos, slashPos + 1) !== '/') return next

      const line = doc.lineAt(slashPos)
      const offsetInLine = slashPos - line.from
      const isLineStart = offsetInLine === 0
      const prevChar =
        offsetInLine > 0 ? doc.sliceString(slashPos - 1, slashPos) : ''
      const isWhitespaceBefore = offsetInLine > 0 && /\s/.test(prevChar)

      if (!isLineStart && !isWhitespaceBefore) return next
      if (isLineInBlock(tr.state, line.number)) return next

      return {
        active: true,
        triggerPos: slashPos,
        query: '',
      }
    }

    if (!next.active || next.triggerPos == null) {
      return next
    }

    const selection = tr.newSelection.main
    if (!selection.empty) return shouldClose()

    const head = selection.head
    const doc = tr.newDoc

    if (head <= next.triggerPos) return shouldClose()
    if (doc.sliceString(next.triggerPos, next.triggerPos + 1) !== '/') {
      return shouldClose()
    }

    const triggerLine = doc.lineAt(next.triggerPos)
    const cursorLine = doc.lineAt(head)
    if (triggerLine.number !== cursorLine.number) return shouldClose()

    const query = doc.sliceString(next.triggerPos + 1, head)
    if (/\s/.test(query)) return shouldClose()

    if (query === next.query) {
      return next
    }

    return {
      ...next,
      query,
    }
  },
})

export const slashMenuExtension = [slashMenuStateField]
