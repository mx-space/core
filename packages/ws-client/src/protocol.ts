export const WS_PROTOCOL_VERSION = 1

export const ACK_EVENT = 'ack'
export const PING_EVENT = 'ping'

export interface WsEnvelope {
  v: number
  event: string
  payload?: unknown
  id?: string
}

export interface WsAckPayload {
  ok: boolean
  code?: string
  [key: string]: unknown
}

export function isWsEnvelope(value: unknown): value is WsEnvelope {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  if (candidate.v !== WS_PROTOCOL_VERSION) return false
  if (typeof candidate.event !== 'string' || candidate.event.length === 0) {
    return false
  }
  if (candidate.id !== undefined && typeof candidate.id !== 'string') {
    return false
  }

  return true
}

export function buildEnvelope(
  event: string,
  payload?: unknown,
  id?: string,
): WsEnvelope {
  return {
    v: WS_PROTOCOL_VERSION,
    event,
    ...(payload !== undefined ? { payload } : {}),
    ...(id ? { id } : {}),
  }
}
