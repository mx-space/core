import type { WsClient } from '@mx-space/ws-client'
import { createWsClient } from '@mx-space/ws-client'

import { GATEWAY_URL } from '../constants/env'
import { toWsOrigin } from './SocketBridge'

let client: WsClient | null = null
const listeners = new Set<(socket: WsClient | null) => void>()

export function subscribeWebSocket(
  listener: (socket: WsClient | null) => void,
): () => void {
  if (!client && GATEWAY_URL) {
    client = createWsClient({ url: `${toWsOrigin(GATEWAY_URL)}/ws/web` })
  }
  listeners.add(listener)
  listener(client)
  return () => {
    listeners.delete(listener)
    if (listeners.size || !client) return
    client.close()
    client = null
  }
}
