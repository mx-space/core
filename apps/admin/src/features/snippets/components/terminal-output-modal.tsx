import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EventSourcePolyfill } from 'event-source-polyfill'
import { toast } from 'sonner'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present } from '~/ui/feedback/modal-imperative'
import { cn } from '~/utils/cn'

import '@xterm/xterm/css/xterm.css'

interface TerminalOutputModalProps {
  onFinish?: () => void
  title: string
  url: string
}

function TerminalOutputModal(props: TerminalOutputModalProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.35,
      theme: {
        background: '#020617',
        foreground: '#e5e7eb',
        selectionBackground: '#334155',
      },
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()
    terminal.focus()
    terminal.writeln(`$ ${props.url}`)
    terminal.writeln('')
    setConnecting(false)

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)

    const eventSource = new EventSourcePolyfill(props.url, {
      withCredentials: true,
    })

    eventSource.onmessage = (event) => {
      terminal.write(event.data)
    }
    eventSource.onerror = (event) => {
      const errorEvent = event as unknown as { data?: string }
      eventSource.close()
      setRunning(false)

      if (errorEvent.data) {
        terminal.writeln('')
        terminal.writeln(errorEvent.data)
        toast.error(errorEvent.data)
        return
      }

      terminal.writeln('')
      terminal.writeln('Done.')
      props.onFinish?.()
    }

    return () => {
      resizeObserver.disconnect()
      eventSource.close()
      terminal.dispose()
      setConnecting(false)
      setRunning(false)
    }
  }, [props.onFinish, props.url])

  return (
    <div className="flex h-[min(82vh,42rem)] w-full flex-col">
      <ModalHeader
        actions={
          connecting || running ? (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              {connecting ? (
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              ) : null}
              {connecting
                ? t('snippets.dialog.terminal.connecting')
                : t('snippets.dialog.terminal.running')}
            </span>
          ) : null
        }
        title={props.title}
      />
      <div
        className={cn(
          'min-h-0 flex-1 bg-slate-950 p-2',
          connecting && 'grid place-items-center',
        )}
      >
        {connecting ? (
          <span className="text-xs text-neutral-400">
            {t('snippets.dialog.terminal.preparing')}
          </span>
        ) : null}
        <div
          aria-label={t('snippets.dialog.terminal.outputAria')}
          className={cn('h-full w-full', connecting && 'hidden')}
          ref={containerRef}
        />
      </div>
    </div>
  )
}

/**
 * Open the terminal output modal. Streams `url` via SSE; on finish invokes `onFinish`.
 */
export function presentTerminalOutput(options: TerminalOutputModalProps) {
  return present<TerminalOutputModalProps>(TerminalOutputModal, options, {
    modalProps: {
      className: 'h-[min(82vh,42rem)]',
      popupStyle: { width: 'min(92vw, 48rem)' },
    },
  })
}
