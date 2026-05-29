import { useEffect, useRef, useState } from 'react'
import { EventSourcePolyfill } from 'event-source-polyfill'
import { toast } from 'sonner'

import { API_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present } from '~/ui/feedback/modal-imperative'
import { Scroll } from '~/ui/primitives/scroll'

function DashboardUpgradeModal() {
  const { t } = useI18n()
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(true)
  const outputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const source = new EventSourcePolyfill(
      `${API_URL}/update/upgrade/dashboard`,
      {
        withCredentials: true,
      },
    )

    source.onmessage = (event) => {
      setOutput((value) => `${value}${event.data}\n`)
    }
    source.onerror = (event) => {
      const errorEvent = event as unknown as { data?: string }
      source.close()
      setRunning(false)

      if (errorEvent.data) {
        toast.error(errorEvent.data)
        return
      }

      setOutput((value) => `${value}\nDone.\n`)
      window.setTimeout(() => {
        window.location.reload()
      }, 1500)
    }

    return () => {
      source.close()
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    const element = outputRef.current
    if (!element) return

    element.scrollTop = element.scrollHeight
  }, [output])

  return (
    <div className="flex h-[min(82vh,42rem)] w-full flex-col">
      <ModalHeader
        actions={
          running ? (
            <span className="text-xs text-neutral-500">
              {t('dashboard.update.running')}
            </span>
          ) : null
        }
        title={t('dashboard.update.outputTitle')}
      />
      <Scroll
        className="min-h-0 flex-1 bg-neutral-950"
        innerClassName="p-4"
        ref={outputRef}
      >
        <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-neutral-100">
          {output || t('dashboard.update.connecting')}
        </pre>
      </Scroll>
    </div>
  )
}

/**
 * Open the dashboard upgrade modal that streams the upgrade output via SSE.
 */
export function presentDashboardUpgrade() {
  return present(
    DashboardUpgradeModal,
    {},
    {
      modalProps: {
        className: 'h-[min(82vh,42rem)]',
        popupStyle: { width: 'min(92vw, 46rem)' },
      },
    },
  )
}
