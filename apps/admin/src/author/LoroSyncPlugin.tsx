import { createLoroBinding, TREE_NAME } from '@haklex/rich-collab-loro'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { LoroDoc, VersionVector } from 'loro-crdt'
import { useEffect } from 'react'

import type { AgentCursorPosition } from './AgentCursor'

export type SyncStatus = 'synced' | 'syncing' | 'offline'

interface Props {
  doc: LoroDoc
  onStatus: (status: SyncStatus) => void
  onInvalid: (message: string | null) => void
  onAgentCursor: (cursor: AgentCursorPosition | null) => void
}

const BATCH_MS = 100

const decode = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

export function LoroSyncPlugin({
  doc,
  onStatus,
  onInvalid,
  onAgentCursor,
}: Props) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const binding = createLoroBinding(editor, doc, { commitMessage: 'human' })
    let sent: VersionVector | undefined = doc.oplogVersion()
    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = false

    const send = async () => {
      timer = undefined
      if (inFlight) {
        timer = setTimeout(send, BATCH_MS)
        return
      }
      const from = sent
      const bytes = doc.export({ mode: 'update', from })
      sent = doc.oplogVersion()
      inFlight = true
      onStatus('syncing')
      try {
        const res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: bytes as Uint8Array<ArrayBuffer>,
        })
        if (!res.ok) throw new Error(`update failed (${res.status})`)
        if (!timer) onStatus('synced')
      } catch {
        sent = from
        onStatus('offline')
      } finally {
        inFlight = false
      }
    }

    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(send, BATCH_MS)
    }
    const unsubscribe = doc.subscribeLocalUpdates(schedule)

    const source = new EventSource('/api/events')
    source.addEventListener('update', (event) => {
      const { bytes } = JSON.parse((event as MessageEvent<string>).data) as {
        bytes: string
      }
      binding.import(decode(bytes))
    })
    source.addEventListener('status', (event) => {
      const { invalid } = JSON.parse((event as MessageEvent<string>).data) as {
        invalid: string | null
      }
      onInvalid(invalid)
    })
    source.addEventListener('cursor', (event) => {
      const { cursor } = JSON.parse((event as MessageEvent<string>).data) as {
        cursor: { id: `${number}@${number}`; offset: number } | null
      }
      const key = cursor ? binding.keyOf(cursor.id) : undefined
      onAgentCursor(key && cursor ? { key, offset: cursor.offset } : null)
    })
    source.addEventListener('error', () => onStatus('offline'))
    source.addEventListener('open', () => {
      void fetch('/api/document')
        .then(
          (res) =>
            res.json() as Promise<{
              snapshot: string
              invalid: string | null
              lineage: string
            }>,
        )
        .then((json) => {
          if (json.lineage !== doc.getTree(TREE_NAME).roots()[0]?.id) {
            onStatus('synced')
            setTimeout(() => location.reload())
            return
          }
          binding.import(decode(json.snapshot))
          onInvalid(json.invalid)
          sent = undefined
          schedule()
        })
        .catch(() => onStatus('offline'))
    })

    return () => {
      clearTimeout(timer)
      source.close()
      unsubscribe()
      binding.dispose()
    }
  }, [editor, doc, onStatus, onInvalid, onAgentCursor])

  return null
}
