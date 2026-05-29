import { useCallback, useEffect, useRef, useState } from 'react'

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdownKeymap } from '@codemirror/lang-markdown'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'

import {
  setEditorView as setStoreEditorView,
  uploadImageFile,
} from './editor-store'
import { codemirrorReconfigureExtension } from './extension'
import { syntaxTheme } from './syntax-highlight'
import { createToolbarKeymapExtension } from './toolbar/keymap-extension'
import {
  getGeneralSetting,
  setGeneralSetting,
} from './universal/use-editor-setting'

interface UseCodeMirrorOptions {
  initialDoc: string
  onChange?: (state: EditorState) => void
  onArrowUpAtFirstLine?: () => void
  enableEditorStore?: boolean
}

interface UseCodeMirrorResult<T extends Element = HTMLDivElement> {
  containerRef: (node: T | null) => void
  view: EditorView | undefined
}

export function useCodeMirror<T extends Element = HTMLDivElement>(
  options: UseCodeMirrorOptions,
): UseCodeMirrorResult<T> {
  const {
    initialDoc,
    onChange,
    onArrowUpAtFirstLine,
    enableEditorStore = true,
  } = options

  const [view, setView] = useState<EditorView | undefined>(undefined)
  const viewRef = useRef<EditorView | undefined>(undefined)
  const onChangeRef = useRef(onChange)
  const onArrowUpRef = useRef(onArrowUpAtFirstLine)
  const initialDocRef = useRef(initialDoc)
  const enableStoreRef = useRef(enableEditorStore)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onArrowUpRef.current = onArrowUpAtFirstLine
  }, [onArrowUpAtFirstLine])

  useEffect(() => {
    enableStoreRef.current = enableEditorStore
  }, [enableEditorStore])

  const containerRef = useCallback((node: T | null) => {
    if (viewRef.current) {
      const handler = (viewRef.current as any).__pasteHandler as
        | ((e: ClipboardEvent) => void)
        | undefined
      if (handler) viewRef.current.dom.removeEventListener('paste', handler)
      viewRef.current.destroy()
      if (enableStoreRef.current) setStoreEditorView(undefined)
      viewRef.current = undefined
      setView(undefined)
    }

    if (!node) return

    const startState = EditorState.create({
      doc: initialDocRef.current,
      extensions: [
        keymap.of([
          {
            key: 'Mod-s',
            run() {
              return false
            },
            preventDefault: true,
          },
          {
            key: 'Enter',
            run(editorView) {
              if (getGeneralSetting().renderMode === 'wysiwyg') {
                const { state } = editorView
                const { from, to } = state.selection.main
                editorView.dispatch({
                  changes: { from, to, insert: '\n\n' },
                  selection: { anchor: from + 2 },
                })
                return true
              }
              return false
            },
          },
          {
            key: 'Mod-/',
            run() {
              const current = getGeneralSetting().renderMode
              setGeneralSetting({
                renderMode: current === 'wysiwyg' ? 'plain' : 'wysiwyg',
              })
              return true
            },
          },
          {
            key: 'ArrowUp',
            run(editorView) {
              const cb = onArrowUpRef.current
              if (getGeneralSetting().renderMode === 'wysiwyg' && cb) {
                const { state } = editorView
                const cursorPos = state.selection.main.head
                const firstLine = state.doc.line(1)
                if (cursorPos <= firstLine.to) {
                  cb()
                  return true
                }
              }
              return false
            },
          },
        ]),
        createToolbarKeymapExtension(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...markdownKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        EditorState.tabSize.of(2),
        search({ top: true }),
        syntaxTheme,
        ...codemirrorReconfigureExtension,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.changes) {
            onChangeRef.current?.(update.state)
          }
        }),
      ],
    })

    const editorView = new EditorView({
      state: startState,
      parent: node,
    })

    viewRef.current = editorView
    setView(editorView)

    if (enableStoreRef.current) {
      setStoreEditorView(editorView)
    }

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0 && enableStoreRef.current) {
        event.preventDefault()
        imageFiles.forEach((file) => uploadImageFile(file))
      }
    }

    editorView.dom.addEventListener('paste', handlePaste)
    ;(editorView as any).__pasteHandler = handlePaste
  }, [])

  useEffect(
    () => () => {
      const current = viewRef.current
      if (current) {
        const handler = (current as any).__pasteHandler as
          | ((e: ClipboardEvent) => void)
          | undefined
        if (handler) current.dom.removeEventListener('paste', handler)
        current.destroy()
        if (enableStoreRef.current) setStoreEditorView(undefined)
        viewRef.current = undefined
      }
    },
    [],
  )

  return { containerRef, view }
}
