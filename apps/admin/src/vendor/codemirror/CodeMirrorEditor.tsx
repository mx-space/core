import { useEffect, useRef } from 'react'
import type { EditorState } from '@codemirror/state'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { RenderMode } from './universal/props'

import { EditorView } from '@codemirror/view'

import {
  codemirrorReconfigureExtensionMap,
  wysiwygModeExtension,
} from './extension'
import { ImageEditPopover } from './ImageEditPopover'
import { SlashMenu, slashMenuExtension } from './slash-menu'
import { FloatingToolbar, useSelectionPosition } from './toolbar'
import { useEditorConfig } from './universal/use-editor-setting'
import { useCodeMirrorConfigureFonts } from './use-auto-fonts'
import { useCodeMirrorAutoToggleTheme } from './use-auto-theme'
import { useCodeMirror } from './use-codemirror'
import { wysiwygExtensions } from './wysiwyg'

import 'katex/dist/katex.min.css'
import './codemirror.css'
import './universal/index.css'

import styles from './universal/editor.module.css'

export interface CodeMirrorEditorProps {
  text: string
  onChange: (value: string) => void
  renderMode?: RenderMode
  onStateChange?: (state: EditorState) => void
  onArrowUpAtFirstLine?: () => void
  className?: string
  embedded?: boolean
  autoFocus?: boolean
  unSaveConfirm?: boolean
  saveConfirmFn?: () => boolean
  style?: CSSProperties
}

export function CodeMirrorEditor({
  text,
  onChange,
  renderMode,
  onStateChange,
  onArrowUpAtFirstLine,
  className,
  embedded = false,
  autoFocus,
  style,
}: CodeMirrorEditorProps) {
  const { general } = useEditorConfig()
  const resolvedMode: RenderMode =
    renderMode ?? general.setting.renderMode ?? 'plain'

  const { containerRef, view } = useCodeMirror<HTMLDivElement>({
    initialDoc: text,
    onChange: (state) => {
      onChange(state.doc.toString())
      onStateChange?.(state)
    },
    onArrowUpAtFirstLine,
    enableEditorStore: !embedded,
  })

  useCodeMirrorAutoToggleTheme(view)
  useCodeMirrorConfigureFonts(view)
  const { position, hasSelection } = useSelectionPosition(view)

  // Sync external text changes
  useEffect(() => {
    if (!view) return
    if (text !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      })
    }
  }, [text, view])

  // Reconfigure wysiwyg compartments on render mode change
  useEffect(() => {
    if (!view) return
    const isWysiwyg = resolvedMode === 'wysiwyg'
    const hadFocus = view.hasFocus
    const extensions = isWysiwyg ? wysiwygExtensions : []
    const selectionHead = view.state.selection.main.head

    view.dispatch({
      effects: [
        codemirrorReconfigureExtensionMap.wysiwyg.reconfigure(extensions),
        codemirrorReconfigureExtensionMap.wysiwygMode.reconfigure(
          isWysiwyg ? [wysiwygModeExtension] : [],
        ),
        codemirrorReconfigureExtensionMap.slashMenu.reconfigure(
          isWysiwyg ? slashMenuExtension : [],
        ),
      ],
    })
    view.requestMeasure()

    if (!embedded) {
      requestAnimationFrame(() => {
        view.dispatch({
          effects: EditorView.scrollIntoView(selectionHead, { y: 'center' }),
        })
      })
    }

    if (hadFocus) {
      requestAnimationFrame(() => view.focus())
    }
  }, [resolvedMode, view, embedded])

  // Auto focus
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!view || !autoFocus || focusedRef.current) return
    focusedRef.current = true
    requestAnimationFrame(() => view.focus())
  }, [view, autoFocus])

  const handleContainerPointerDown = (event: ReactPointerEvent) => {
    if (!view) return
    if (embedded) return
    if (resolvedMode !== 'wysiwyg') return
    if (event.button !== 0) return

    const path = event.nativeEvent.composedPath?.() ?? []
    if (path.includes(view.contentDOM)) return

    const target = event.target
    if (target instanceof Node && view.contentDOM.contains(target)) return

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return

    event.preventDefault()
    view.focus()
    view.dispatch({ selection: { anchor: pos } })
  }

  return (
    <div
      className={embedded ? 'relative' : 'relative flex h-full flex-col'}
      onPointerDown={handleContainerPointerDown}
      style={style}
    >
      <div
        className={`${styles.editor} ${className ?? ''} ${
          embedded ? '' : 'flex-1 overflow-auto'
        }`}
        ref={containerRef}
      />
      {!embedded && (
        <FloatingToolbar
          editorView={view}
          visible={hasSelection}
          position={position}
        />
      )}
      {!embedded && resolvedMode === 'wysiwyg' && (
        <SlashMenu editorView={view} />
      )}
      {!embedded && <ImageEditPopover />}
    </div>
  )
}
