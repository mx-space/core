import { randomUUID } from 'node:crypto'

import { LoroDoc } from 'loro-crdt'

export interface Ack {
  readonly ok: boolean
  readonly code?: string
  readonly data?: any
}

export interface IncomingPresence {
  readonly caret: any
  readonly connectionId: string
  readonly documentId: string
  readonly entry: string | null
  readonly user: {
    readonly avatar: string | null
    readonly id: string
    readonly name: string
  }
}

export interface Room {
  readonly doc: LoroDoc
  readonly documentId: string
  readonly connectionId: string
  readonly push: (update: Uint8Array) => Promise<Ack>
  readonly presence: (payload: {
    caret: unknown
    entry?: string
  }) => Promise<Ack>
  readonly presences: () => IncomingPresence[]
  readonly waitForPresence: (ms: number) => Promise<void>
  readonly close: () => void
}

export interface RoomOptions {
  readonly url: string
  readonly headers: Record<string, string>
  readonly draftId: string
  readonly timeoutMs?: number
}

export class RoomError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'RoomError'
  }
}

export class RoomAuthError extends RoomError {
  constructor() {
    super(
      'the server refused the collaboration socket (401). Sign in again with `mxs auth login`; if that does not help, the server is older than this CLI',
      'NOT_AUTHENTICATED',
    )
    this.name = 'RoomAuthError'
  }
}

interface Frame {
  readonly v: number
  readonly event: string
  readonly payload?: any
  readonly id?: string
}

type HeaderWebSocket = new (
  url: string,
  init: { headers: Record<string, string> },
) => WebSocket

const AUTH_FAILED = 4401
const PRESENCE_GRACE_MS = 100

const LOOPBACK = /^(?:localhost|127\.0\.0\.1|\[::1\])$/

const wsBase = (url: URL, path: string) =>
  `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}${path.replace(/\/+$/, '')}`

export function gatewayUrlFor(apiBase: string, advertised?: string): string {
  const api = new URL(apiBase)
  if (advertised) {
    const gateway = new URL(advertised)
    const placeholder =
      LOOPBACK.test(gateway.hostname) && !LOOPBACK.test(api.hostname)
    if (!placeholder) return `${wsBase(gateway, gateway.pathname)}/ws/admin`
  }
  return `${wsBase(api, api.pathname.replace(/\/api\/v\d+\/?$/, ''))}/ws/admin`
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const unb64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'))

export async function openRoom(options: RoomOptions): Promise<Room> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const Socket = globalThis.WebSocket as unknown as HeaderWebSocket
  const ws = new Socket(options.url, { headers: options.headers })
  const pending = new Map<string, (ack: Ack) => void>()
  const presences: IncomingPresence[] = []
  const presenceWaiters = new Set<() => void>()
  const doc = new LoroDoc()
  let closedWith: RoomError | undefined

  const failAll = (error: RoomError) => {
    closedWith = error
    for (const resolve of pending.values()) {
      resolve({ ok: false, code: error.code ?? 'NOT_CONNECTED' })
    }
    pending.clear()
  }

  const connected = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new RoomError(`timed out connecting to ${options.url}`))
      ws.close()
    }, timeoutMs)
    ws.addEventListener('message', (event) => {
      const frame = JSON.parse(String(event.data)) as Frame
      if (frame.event === 'ack' && frame.id) {
        pending.get(frame.id)?.(frame.payload as Ack)
        pending.delete(frame.id)
        return
      }
      if (frame.event === 'gateway.connect') {
        clearTimeout(timer)
        resolve()
        return
      }
      if (frame.event === 'collab.update') {
        doc.import(unb64(frame.payload.update))
        return
      }
      if (frame.event === 'collab.presence') {
        presences.push(frame.payload as IncomingPresence)
        for (const wake of presenceWaiters) wake()
      }
    })
    ws.addEventListener('close', (event) => {
      clearTimeout(timer)
      const error =
        event.code === AUTH_FAILED
          ? new RoomAuthError()
          : new RoomError(`collaboration socket closed (${event.code})`)
      failAll(error)
      reject(error)
    })
    ws.addEventListener('error', () => undefined)
  })

  await connected

  const request = (event: string, payload: unknown) =>
    new Promise<Ack>((resolve) => {
      if (closedWith) {
        resolve({ ok: false, code: closedWith.code ?? 'NOT_CONNECTED' })
        return
      }
      const id = randomUUID()
      pending.set(id, resolve)
      ws.send(JSON.stringify({ v: 1, event, payload, id }))
    })

  const join = await request('collab.join', { draftId: options.draftId })
  if (!join.ok) {
    ws.close()
    throw new RoomError(
      `could not join draft ${options.draftId}: ${join.code}`,
      join.code,
    )
  }
  doc.import(unb64(join.data.update))

  return {
    doc,
    documentId: join.data.documentId,
    connectionId: join.data.connectionId,
    async push(update) {
      const ack = await request('collab.update', {
        draftId: options.draftId,
        update: b64(update),
      })
      if (!ack.ok) {
        throw new RoomError(
          `the server rejected the edit: ${ack.code}`,
          ack.code,
        )
      }
      return ack
    },
    presence: (payload) =>
      request('collab.presence', { draftId: options.draftId, ...payload }),
    presences: () => [...presences],
    waitForPresence: (ms) =>
      new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer)
          presenceWaiters.delete(onFrame)
          resolve()
        }
        // Every open tab answers the join at about the same time; a short grace keeps the later ones.
        const onFrame = () => {
          presenceWaiters.delete(onFrame)
          setTimeout(finish, PRESENCE_GRACE_MS)
        }
        const timer = setTimeout(finish, ms)
        if (presences.length > 0) onFrame()
        else presenceWaiters.add(onFrame)
      }),
    close: () => ws.close(),
  }
}
