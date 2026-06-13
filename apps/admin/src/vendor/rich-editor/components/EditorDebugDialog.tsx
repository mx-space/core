import type { ReactNode } from 'react'
import { Fragment, useMemo } from 'react'
import { toast } from 'sonner'

import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'

interface EditorDebugDialogProps {
  editorStateJson: string
}

const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)|\b(true|false|null)\b/g

function highlightJson(json: string): ReactNode[] {
  const out: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  JSON_TOKEN_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null = JSON_TOKEN_PATTERN.exec(json)
  while (m !== null) {
    if (m.index > lastIndex) out.push(json.slice(lastIndex, m.index))
    const [, str, colon, num, lit] = m
    if (str !== undefined) {
      if (colon !== undefined) {
        out.push(
          <span className="text-sky-700 dark:text-sky-400" key={key++}>
            {str}
          </span>,
          colon,
        )
      } else {
        out.push(
          <span className="text-emerald-700 dark:text-emerald-400" key={key++}>
            {str}
          </span>,
        )
      }
    } else if (num !== undefined) {
      out.push(
        <span className="text-amber-700 dark:text-amber-400" key={key++}>
          {num}
        </span>,
      )
    } else if (lit !== undefined) {
      out.push(
        <span className="text-purple-700 dark:text-purple-400" key={key++}>
          {lit}
        </span>,
      )
    }
    lastIndex = JSON_TOKEN_PATTERN.lastIndex
    m = JSON_TOKEN_PATTERN.exec(json)
  }
  if (lastIndex < json.length) out.push(json.slice(lastIndex))
  return out
}

function EditorDebugDialog({ editorStateJson }: EditorDebugDialogProps) {
  const modal = useModal<void>()
  const highlighted = useMemo(
    () => highlightJson(editorStateJson),
    [editorStateJson],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editorStateJson)
      toast.success('已复制至剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([editorStateJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lexical-state-${new Date()
      .toISOString()
      .replaceAll(':', '-')}.json`
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex max-h-[80vh] w-full flex-col">
      <ModalHeader title="调试 · Editor State" />
      <div className="min-h-0 flex-1 overflow-auto bg-surface-inset px-6 py-4">
        <pre className="m-0 whitespace-pre font-mono text-xs leading-relaxed text-fg">
          {highlighted.map((node, i) => (
            <Fragment key={i}>{node}</Fragment>
          ))}
        </pre>
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          关闭
        </Button>
        <Button onClick={handleDownload} type="button" variant="secondary">
          下载
        </Button>
        <Button onClick={handleCopy} type="button" variant="primary">
          复制
        </Button>
      </ModalFooter>
    </div>
  )
}

export function presentEditorDebugDialog(editorStateJson: string) {
  return present(
    EditorDebugDialog,
    { editorStateJson },
    {
      modalProps: {
        popupStyle: { width: 'min(92vw, 48rem)', maxHeight: '80vh' },
      },
    },
  )
}
