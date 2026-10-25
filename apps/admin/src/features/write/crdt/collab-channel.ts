import type { WsClient, WsClientState } from '@mx-space/ws-client'

import { ApiRequestError } from '~/api/http'
import { subscribeAdminSocket } from '~/socket/SocketBridge'

import { CRDT_REJECTED_CODE, type CrdtTransport } from './crdt-sync'

export type CollabSocket = Pick<WsClient, 'on' | 'request'> & {
  readonly state: WsClientState
}

export interface CollabChannelOptions {
  draftId: string
  http: CrdtTransport
  maxFrameBytes?: number
  onPeerJoined?: (connectionId: string) => void
  onPeerLeft?: (connectionId: string) => void
  onPresence?: (state: Uint8Array) => void
  onReconnect?: () => void
  onRemote: (update: Uint8Array) => void
  subscribeSocket?: (
    listener: (socket: CollabSocket | null) => void,
  ) => () => void
}

export interface CollabChannel extends CrdtTransport {
  dispose: () => void
  live: () => boolean
  sendPresence: (state: Uint8Array) => void
}

interface DocumentFrame {
  connectionId?: string
  documentId?: string
  state?: string
  update?: string
}

const CHUNK = 0x8000

export const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK))
  }
  return btoa(binary)
}

export const decodeBase64 = (value: string) => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function createCollabChannel(
  options: CollabChannelOptions,
): CollabChannel {
  const { draftId, http } = options
  const maxFrameBytes = options.maxFrameBytes ?? 512 * 1024
  let socket: CollabSocket | null = null
  let documentId: string | null = null
  let dropped = false
  let disposed = false
  let unbind: Array<() => void> = []

  const open = () => socket?.state === 'open'
  const live = () => open() && documentId !== null

  const forDocument =
    (handle: (frame: DocumentFrame) => void) => (frame: DocumentFrame) => {
      if (!disposed && documentId && frame?.documentId === documentId) {
        handle(frame)
      }
    }

  const bind = (next: CollabSocket | null) => {
    for (const off of unbind) off()
    unbind = []
    socket = next
    if (!next) return
    unbind = [
      next.on(
        'collab.update',
        forDocument((frame) => {
          if (frame.update) options.onRemote(decodeBase64(frame.update))
        }),
      ),
      next.on(
        'collab.presence',
        forDocument((frame) => {
          if (frame.state) options.onPresence?.(decodeBase64(frame.state))
        }),
      ),
      next.on(
        'collab.peer.joined',
        forDocument((frame) => {
          if (frame.connectionId) options.onPeerJoined?.(frame.connectionId)
        }),
      ),
      next.on(
        'collab.peer.left',
        forDocument((frame) => {
          if (frame.connectionId) options.onPeerLeft?.(frame.connectionId)
        }),
      ),
      next.on('$state', (state: WsClientState) => {
        if (state !== 'open') {
          if (documentId) dropped = true
          return
        }
        if (!dropped || disposed) return
        dropped = false
        documentId = null
        options.onReconnect?.()
      }),
    ]
  }

  const unsubscribe = (options.subscribeSocket ?? subscribeAdminSocket)(
    (next) => {
      const replaced = socket !== null && next !== socket && documentId
      bind(next)
      if (replaced && !disposed) {
        documentId = null
        options.onReconnect?.()
      }
    },
  )

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      if (open() && documentId) {
        void socket!.request('collab.leave', { draftId }).catch(() => undefined)
      }
      unsubscribe()
      for (const off of unbind) off()
      unbind = []
    },
    live,
    pull: async (since) => {
      if (!open()) return http.pull(since)
      const ack = await socket!.request('collab.join', {
        draftId,
        ...(since ? { since: encodeBase64(since) } : {}),
      })
      const data = ack.data as { documentId: string; update: string }
      documentId = data.documentId
      return decodeBase64(data.update)
    },
    push: async (bytes) => {
      if (!live() || bytes.length > maxFrameBytes) return http.push(bytes)
      try {
        await socket!.request('collab.update', {
          draftId,
          update: encodeBase64(bytes),
        })
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === CRDT_REJECTED_CODE) {
          throw new ApiRequestError((error as Error).message, code, 400)
        }
        throw error
      }
    },
    sendPresence: (state) => {
      if (!live()) return
      void socket!
        .request('collab.presence', { draftId, state: encodeBase64(state) })
        .catch(() => undefined)
    },
  }
}
