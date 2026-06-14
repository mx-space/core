import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorToolbar } from './EditorToolbar'

const mocks = vi.hoisted(() => {
  const editor = {
    dispatchCommand: vi.fn(),
    getEditorState: vi.fn(() => ({ toJSON: () => ({ root: {} }) })),
    update: vi.fn((fn: () => void) => fn()),
  }

  return {
    applyBlockType: vi.fn(),
    applyFontFamily: vi.fn(),
    editor,
    insertSelect: vi.fn(),
    presentEditorDebugDialog: vi.fn(),
  }
})

vi.mock('@haklex/rich-editor/commands', async () => {
  const { createElement } = await import('react')

  return {
    $toggleSpoilerSelection: vi.fn(),
    collectCommandItems: () => [
      {
        group: 'insert',
        icon: createElement('span', null, 'I'),
        onSelect: mocks.insertSelect,
        placement: ['toolbar'],
        title: 'Image',
      },
    ],
  }
})

vi.mock('@haklex/rich-plugin-toolbar', () => ({
  FONT_FAMILIES: [],
  applyBlockType: mocks.applyBlockType,
  applyFontFamily: mocks.applyFontFamily,
  getFontLabel: () => 'System',
  useToolbarState: () => ({
    blockType: 'paragraph',
    canRedo: false,
    canUndo: false,
    elementFormat: '',
    fontFamily: '',
    isBold: false,
    isCode: false,
    isHighlight: false,
    isItalic: false,
    isSpoiler: false,
    isStrikethrough: false,
    isUnderline: false,
  }),
}))

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mocks.editor],
}))

vi.mock('./EditorDebugDialog', () => ({
  presentEditorDebugDialog: mocks.presentEditorDebugDialog,
}))

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function renderToolbar() {
  act(() => {
    harness.root.render(createElement(EditorToolbar))
  })
}

function findButton(label: string): HTMLButtonElement {
  const button = document.querySelector(
    `button[aria-label="${label}"]`,
  ) as HTMLButtonElement | null

  if (!button) throw new Error(`Missing toolbar button: ${label}`)
  return button
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('EditorToolbar', () => {
  it('keeps selection on mouse down but runs insert commands on click', () => {
    renderToolbar()

    const button = findButton('Image')
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    })

    act(() => {
      button.dispatchEvent(mouseDown)
    })

    expect(mouseDown.defaultPrevented).toBe(true)
    expect(mocks.insertSelect).not.toHaveBeenCalled()

    act(() => {
      button.click()
    })

    expect(mocks.insertSelect).toHaveBeenCalledTimes(1)
    expect(mocks.insertSelect).toHaveBeenCalledWith(mocks.editor, '')
  })
})
