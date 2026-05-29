import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  MountRichEditorOptions,
  RichEditorHandle,
} from '~/vendor/rich-editor/mount/mount-rich-editor'

import { resolveEnrichment } from '~/api/enrichment'
import { uploadFile } from '~/api/files'
import { API_URL } from '~/constants/env'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

const STORAGE_KEY = 'debug-rich-editor-content'

export function RichDebugRouteViewContent() {
  const { t } = useI18n()
  const [content, setContent] = useState(() => {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  })
  const [text, setText] = useState('')
  const [editorKey, setEditorKey] = useState(0)

  const stats = useMemo(() => {
    const contentBytes = new Blob([content]).size
    const textLength = text.trim().length

    return {
      contentSize: formatBytes(contentBytes),
      textLength,
    }
  }, [content, text])

  const handleContentChange = (nextContent: string) => {
    setContent(nextContent)
    window.localStorage.setItem(STORAGE_KEY, nextContent)
  }

  const handleReset = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setContent('')
    setText('')
    setEditorKey((value) => value + 1)
    toast.success(t('debug.rich.resetSuccess'))
  }

  const placeholderText = t('debug.rich.placeholder')

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {t('debug.rich.title')}
          </div>
          <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {t('debug.rich.charsAndSize', {
              chars: stats.textLength,
              size: stats.contentSize,
            })}
          </div>
        </div>
        <Button onClick={handleReset} type="button" variant="subtle">
          <RotateCcw aria-hidden="true" className="size-4" />
          {t('debug.rich.reset')}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <RichDebugSurface
          content={content}
          key={editorKey}
          onContentChange={handleContentChange}
          onTextChange={setText}
          placeholder={placeholderText}
        />
      </div>
    </div>
  )
}

function RichDebugSurface(props: {
  content: string
  onContentChange: (content: string) => void
  onTextChange: (text: string) => void
  placeholder: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<RichEditorHandle | null>(null)
  const initialValueRef = useRef(parseSerializedEditorState(props.content))
  const placeholderRef = useRef(props.placeholder)
  const latestCallbacks = useRef({
    onContentChange: props.onContentChange,
    onTextChange: props.onTextChange,
  })

  latestCallbacks.current = {
    onContentChange: props.onContentChange,
    onTextChange: props.onTextChange,
  }

  useEffect(() => {
    let disposed = false

    const mount = async () => {
      if (!containerRef.current) return

      const { mountRichEditor } =
        await import('~/vendor/rich-editor/mount/mount-rich-editor')

      if (disposed || !containerRef.current) return

      const options: MountRichEditorOptions = {
        apiUrl: API_URL,
        autoFocus: true,
        className: 'h-full bg-white dark:bg-neutral-950',
        contentClassName: 'min-h-full px-5 py-4',
        debounceMs: 250,
        editorStyle: { maxWidth: '100%' },
        fetchEnrichment: (url) => resolveEnrichment(url).catch(() => null),
        imageUpload: async (file) => {
          const result = await uploadFile(file, 'image')

          return { src: result.url }
        },
        initialValue: initialValueRef.current,
        onChange: (value) => {
          latestCallbacks.current.onContentChange(JSON.stringify(value))
        },
        onTextChange: (text) => {
          latestCallbacks.current.onTextChange(text)
        },
        placeholder: placeholderRef.current,
        saveExcalidrawSnapshot,
        theme: getColorScheme(),
        variant: 'article',
      }

      editorRef.current = mountRichEditor(containerRef.current, options)
    }

    void mount()

    return () => {
      disposed = true
      editorRef.current?.unmount()
      editorRef.current = null
    }
  }, [])

  return <div className="h-full min-h-0" ref={containerRef} />
}

function parseSerializedEditorState(
  content: string,
): MountRichEditorOptions['initialValue'] {
  if (!content.trim()) return undefined

  try {
    const parsed = JSON.parse(content)

    if (parsed && typeof parsed === 'object' && 'root' in parsed) {
      return parsed as MountRichEditorOptions['initialValue']
    }
  } catch {
    return undefined
  }

  return undefined
}

async function saveExcalidrawSnapshot(snapshot: object, existingRef?: string) {
  const name = existingRef
    ? `${existingRef.replace(/[^\w.-]/g, '-')}.json`
    : `excalidraw-${crypto.randomUUID()}.json`
  const file = new File([JSON.stringify(snapshot)], name, {
    type: 'application/json',
  })
  const result = await uploadFile(file, 'file')

  return result.url
}

function getColorScheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`

  return `${(value / 1024).toFixed(1)} KB`
}
