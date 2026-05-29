import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { $getNearestNodeFromDOMNode } from 'lexical'
import type { TagRendererProps } from '@haklex/rich-editor/static'

import { useRendererMode } from '@haklex/rich-editor'
import { getTagBgColor, TagRenderer } from '@haklex/rich-editor/static'

export function TagEditRenderer(props: TagRendererProps) {
  const mode = useRendererMode()

  if (mode !== 'editor') {
    return <TagRenderer {...props} />
  }

  return <TagEditRendererInner {...props} />
}

function TagEditRendererInner({ text }: TagRendererProps) {
  const [editor] = useLexicalComposerContext()
  const editable = editor.isEditable()
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(text)

  useEffect(() => {
    setEditText(text)
  }, [text])

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing])

  const commitChanges = useCallback(() => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === text) {
      setEditText(text)
      setEditing(false)
      return
    }
    if (!wrapperRef.current) return

    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(wrapperRef.current!)
      if (!node) return
      const writable = node.getWritable() as unknown as Record<string, unknown>
      writable.__text = trimmed
    })
    setEditing(false)
  }, [editor, editText, text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        commitChanges()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setEditText(text)
        setEditing(false)
      }
    },
    [commitChanges, text],
  )

  if (!editable) {
    return <TagRenderer text={text} />
  }

  const bgColor = getTagBgColor(editing ? editText : text)

  if (editing) {
    return (
      <span
        className="rich-tag"
        ref={wrapperRef}
        style={{
          backgroundColor: bgColor,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={editText}
          style={{
            appearance: 'none',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            padding: 0,
            margin: 0,
            outline: 'none',
            width: `${Math.max(editText.length, 1)}ch`,
            minWidth: '2ch',
          }}
          onBlur={commitChanges}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </span>
    )
  }

  return (
    <span
      className="rich-tag"
      ref={wrapperRef}
      style={{ backgroundColor: bgColor, cursor: 'pointer' }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {text}
    </span>
  )
}
