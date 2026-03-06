import { cn } from '@/lib/utils'
import { CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type EditorState,
} from 'lexical'
import { useCallback, useEffect, useRef } from 'react'

const theme = {
  paragraph: 'mb-0',
  heading: {
    h1: 'text-lg font-bold',
    h2: 'text-base font-bold',
    h3: 'text-sm font-bold',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-secondary rounded px-1 py-0.5 font-mono text-xs',
  },
  code: 'bg-secondary rounded-md p-2 font-mono text-xs block',
  quote:
    'border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic',
  list: {
    ul: 'list-disc pl-4',
    ol: 'list-decimal pl-4',
  },
}

function EnterKeyPlugin({ onSubmit }: { onSubmit: () => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event && !event.shiftKey) {
          event.preventDefault()
          onSubmit()
          return true
        }
        return false
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor, onSubmit])

  return null
}

function ClearEditorPlugin({
  clearRef,
}: {
  clearRef: React.MutableRefObject<(() => void) | null>
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    clearRef.current = () => {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        const paragraph = $createParagraphNode()
        paragraph.append($createTextNode(''))
        root.append(paragraph)
      })
    }
  }, [editor, clearRef])

  return null
}

function FocusPlugin({
  focusRef,
}: {
  focusRef: React.MutableRefObject<(() => void) | null>
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    focusRef.current = () => {
      editor.focus()
    }
  }, [editor, focusRef])

  return null
}

interface RichEditorProps {
  onSubmit: (text: string) => void
  placeholder?: string
  className?: string
}

export function RichEditor({
  onSubmit,
  placeholder = 'Type a message...',
  className,
}: RichEditorProps) {
  const textRef = useRef('')
  const clearRef = useRef<(() => void) | null>(null)
  const focusRef = useRef<(() => void) | null>(null)

  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot()
      textRef.current = root.getTextContent()
    })
  }, [])

  const handleSubmit = useCallback(() => {
    const text = textRef.current.trim()
    if (!text) return
    onSubmit(text)
    clearRef.current?.()
    setTimeout(() => focusRef.current?.(), 0)
  }, [onSubmit])

  const initialConfig = {
    namespace: 'AgentEditor',
    theme,
    nodes: [HeadingNode, QuoteNode, CodeNode, LinkNode, ListNode, ListItemNode],
    onError: (error: Error) => {
      console.error('[v0] Lexical error:', error)
    },
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn('relative', className)}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[60px] max-h-[200px] overflow-y-auto px-4 py-3 text-sm text-foreground outline-none leading-relaxed"
              aria-label="Message input"
            />
          }
          placeholder={
            <div className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground/60">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
        <EnterKeyPlugin onSubmit={handleSubmit} />
        <ClearEditorPlugin clearRef={clearRef} />
        <FocusPlugin focusRef={focusRef} />
      </div>
    </LexicalComposer>
  )
}
