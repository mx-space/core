import type { LoroDoc, VersionVector } from 'loro-crdt'

import { ApiRequestError } from '~/api/http'

export type CrdtSyncStatus = 'offline' | 'synced' | 'syncing'

export interface CrdtTransport {
  pull: (since?: Uint8Array) => Promise<Uint8Array>
  push: (bytes: Uint8Array) => Promise<void>
}

export interface CrdtSyncOptions {
  apply?: (bytes: Uint8Array) => void
  batchMs?: number
  doc: LoroDoc
  onRejected?: (error: ApiRequestError) => void
  onStatus?: (status: CrdtSyncStatus) => void
  retryMs?: number
  transport: CrdtTransport
}

export interface CrdtSync {
  dispose: () => void
  flush: () => Promise<void>
  pending: () => boolean
  pull: () => Promise<void>
  receive: (bytes: Uint8Array) => void
}

export const CRDT_REJECTED_CODE = 'DRAFT_CRDT_UPDATE_REJECTED'

export async function createCrdtSync(
  options: CrdtSyncOptions,
): Promise<CrdtSync> {
  const { doc, transport } = options
  const batchMs = options.batchMs ?? 100
  const retryMs = options.retryMs ?? 2000
  const apply = options.apply ?? ((bytes: Uint8Array) => doc.import(bytes))

  doc.import(await transport.pull())
  let sent: VersionVector = doc.oplogVersion()
  let dirty = false
  let rejected = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | null = null
  let failed = false

  const setStatus = (status: CrdtSyncStatus) => options.onStatus?.(status)

  const send = async (): Promise<void> => {
    timer = undefined
    if (!dirty || rejected || disposed) return
    const from = sent
    const target = doc.oplogVersion()
    dirty = false
    setStatus('syncing')
    try {
      await transport.push(doc.export({ from, mode: 'update' }))
      sent = target
      failed = false
      if (!dirty) setStatus('synced')
    } catch (error) {
      dirty = true
      failed = true
      if (
        error instanceof ApiRequestError &&
        error.code === CRDT_REJECTED_CODE
      ) {
        rejected = true
        options.onRejected?.(error)
        return
      }
      setStatus('offline')
      if (!disposed) timer = setTimeout(run, retryMs)
    }
  }

  const run = (): Promise<void> => {
    if (inFlight) return inFlight.then(run)
    const current = send().finally(() => {
      if (inFlight === current) inFlight = null
    })
    inFlight = current
    return current
  }

  const schedule = () => {
    dirty = true
    if (timer || rejected) return
    timer = setTimeout(run, batchMs)
  }

  const receive = (bytes: Uint8Array) => {
    apply(bytes)
    if (!dirty && !inFlight) sent = doc.oplogVersion()
  }

  const unsubscribe = doc.subscribeLocalUpdates(schedule)

  return {
    dispose: () => {
      disposed = true
      clearTimeout(timer)
      unsubscribe()
    },
    flush: async () => {
      clearTimeout(timer)
      timer = undefined
      for (;;) {
        if (rejected) throw new Error('The server rejected unsent edits')
        if (inFlight) {
          await inFlight
          continue
        }
        if (!dirty) return
        await run()
        if (dirty && failed) throw new Error('Unsent edits remain')
      }
    },
    pending: () => dirty || inFlight !== null,
    pull: async () => {
      receive(await transport.pull(doc.oplogVersion().encode()))
    },
    receive,
  }
}
