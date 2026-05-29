import { Bold, Code, Italic, Link, Strikethrough } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import type { ComponentType, SVGProps } from 'react'
import type { SelectionPosition } from './use-selection-position'

import { commands, isInlineFormatActive } from './markdown-commands'

import './floating-toolbar.css'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

interface ToolbarButton {
  icon: IconComponent
  title: string
  shortcut: string
  action: (view: EditorView) => void
  isActive?: (view: EditorView) => boolean
}

interface ToolbarGroup {
  id: string
  buttons: ToolbarButton[]
}

const groups: ToolbarGroup[] = [
  {
    id: 'format',
    buttons: [
      {
        icon: Bold,
        title: '粗体',
        shortcut: '⌘B',
        action: commands.bold,
        isActive: (view) => isInlineFormatActive(view, 'bold'),
      },
      {
        icon: Italic,
        title: '斜体',
        shortcut: '⌘I',
        action: commands.italic,
        isActive: (view) => isInlineFormatActive(view, 'italic'),
      },
      {
        icon: Strikethrough,
        title: '删除线',
        shortcut: '⌘D',
        action: commands.strikethrough,
        isActive: (view) => isInlineFormatActive(view, 'strikethrough'),
      },
    ],
  },
  {
    id: 'insert',
    buttons: [
      {
        icon: Link,
        title: '链接',
        shortcut: '⌘K',
        action: commands.link,
      },
      {
        icon: Code,
        title: '代码',
        shortcut: '⌘E',
        action: commands.inlineCode,
        isActive: (view) => isInlineFormatActive(view, 'inlineCode'),
      },
    ],
  },
]

interface FloatingToolbarProps {
  editorView: EditorView | undefined
  visible: boolean
  position: SelectionPosition | null
}

export function FloatingToolbar({
  editorView,
  visible,
  position,
}: FloatingToolbarProps) {
  const [selectionVersion, setSelectionVersion] = useState(0)

  useEffect(() => {
    if (!editorView) return
    const bump = () => setSelectionVersion((v) => v + 1)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === 'Shift' ||
        e.key.startsWith('Arrow') ||
        e.ctrlKey ||
        e.metaKey
      ) {
        bump()
      }
    }
    editorView.dom.addEventListener('mouseup', bump)
    editorView.dom.addEventListener('mousedown', bump)
    editorView.dom.addEventListener('keyup', handleKeyUp)
    return () => {
      editorView.dom.removeEventListener('mouseup', bump)
      editorView.dom.removeEventListener('mousedown', bump)
      editorView.dom.removeEventListener('keyup', handleKeyUp)
    }
  }, [editorView])

  if (!visible || !position) return null
  if (typeof document === 'undefined') return null

  const executeCommand = (action: (view: EditorView) => void) => {
    if (!editorView) return
    action(editorView)
    editorView.focus()
    setSelectionVersion((v) => v + 1)
  }

  const overlay = (
    <div
      className="floating-toolbar fixed z-50 flex items-center rounded-xl border border-neutral-200/60 bg-white/95 p-1 shadow-xl shadow-neutral-900/10 backdrop-blur-xl backdrop-saturate-150 dark:border-neutral-700/60 dark:bg-neutral-900/95 dark:shadow-neutral-950/50"
      style={{
        left: `${position.x}px`,
        top: position.above ? `${position.y - 52}px` : `${position.y + 8}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()}
      data-selection-version={selectionVersion}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.id} className="flex items-center">
          {groupIndex > 0 && (
            <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
          )}
          <div className="flex items-center gap-0.5">
            {group.buttons.map((button) => {
              const Icon = button.icon
              const active =
                editorView && button.isActive
                  ? button.isActive(editorView)
                  : false
              return (
                <button
                  key={button.title}
                  type="button"
                  aria-label={button.title}
                  onClick={() => executeCommand(button.action)}
                  className={`group relative flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-all duration-150 hover:bg-neutral-100 hover:text-neutral-900 active:scale-95 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 ${
                    active
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200'
                      : ''
                  }`}
                >
                  <Icon width={16} height={16} strokeWidth={2} />
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 scale-95 whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 dark:bg-neutral-100 dark:text-neutral-900">
                    <div className="flex items-center gap-2">
                      <span>{button.title}</span>
                      <kbd className="rounded bg-neutral-700 px-1 py-0.5 font-mono text-xs text-neutral-300 dark:bg-neutral-300 dark:text-neutral-600">
                        {button.shortcut}
                      </kbd>
                    </div>
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-100" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return createPortal(overlay, document.body)
}
