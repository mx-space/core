import {
  computeReconnectDelayMs,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
  type WsBackoffOptions,
} from './backoff.js'
import { createWsError } from './errors.js'
import { PendingRequests } from './pending-requests.js'
import {
  ACK_EVENT,
  buildEnvelope,
  isWsEnvelope,
  PING_EVENT,
  type WsAckPayload,
} from './protocol.js'

export type WsClientState = 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface WsClientOptions {
  url: string
  query?: Record<string, string>
  pingIntervalMs?: number
  pingTimeoutMs?: number
  requestTimeoutMs?: number
  backoff?: WsBackoffOptions
  webSocketImpl?: typeof WebSocket
}

export interface WsClient {
  on: ((event: string, handler: (payload: any) => void) => () => void) &
    ((event: '$state', handler: (state: WsClientState) => void) => () => void)
  send: (event: string, payload?: unknown) => void
  request: (
    event: string,
    payload?: unknown,
    opts?: { timeout?: number },
  ) => Promise<WsAckPayload>
  close: () => void
  readonly state: WsClientState
}

function resolveUrl(url: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) return url
  const resolved = new URL(url)
  for (const [key, value] of Object.entries(query)) {
    resolved.searchParams.set(key, value)
  }
  return resolved.toString()
}

export function createWsClient(options: WsClientOptions): WsClient {
  const WebSocketImpl = options.webSocketImpl ?? globalThis.WebSocket
  if (!WebSocketImpl) {
    throw createWsError('No WebSocket implementation available', 'NO_IMPL')
  }

  const pingIntervalMs = options.pingIntervalMs ?? 30_000
  const pingTimeoutMs = options.pingTimeoutMs ?? 10_000
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000
  const backoffBaseMs = options.backoff?.baseMs ?? DEFAULT_BACKOFF_BASE_MS
  const backoffMaxMs = options.backoff?.maxMs ?? DEFAULT_BACKOFF_MAX_MS
  const resolvedUrl = resolveUrl(options.url, options.query)

  const listeners = new Map<string, Set<(payload: any) => void>>()
  const pending = new PendingRequests()

  let state: WsClientState = 'connecting'
  let socket: WebSocket
  let attempt = 0
  let explicitlyClosed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined
  let idCounter = 0
  const idPrefix = Math.random().toString(36).slice(2, 8)

  function nextRequestId(): string {
    idCounter += 1
    return `${idPrefix}-${idCounter}`
  }

  function setState(next: WsClientState): void {
    if (state === next) return
    state = next
    dispatch('$state', next)
  }

  function dispatch(event: string, payload: unknown): void {
    const handlers = listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) handler(payload)
  }

  function stopPingLoop(): void {
    if (pingTimer === undefined) return
    clearInterval(pingTimer)
    pingTimer = undefined
  }

  function startPingLoop(): void {
    stopPingLoop()
    pingTimer = setInterval(() => {
      request(PING_EVENT, undefined, { timeout: pingTimeoutMs }).catch(() => {
        forceCloseSocket()
      })
    }, pingIntervalMs)
  }

  function forceCloseSocket(): void {
    const terminate = (socket as unknown as { terminate?: () => void })
      .terminate
    if (typeof terminate === 'function') terminate.call(socket)
    else socket.close()
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer === undefined) return
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }

  function scheduleReconnect(): void {
    setState('reconnecting')
    const delay = computeReconnectDelayMs(attempt, backoffBaseMs, backoffMaxMs)
    attempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      connect()
    }, delay)
  }

  function handleDisconnect(): void {
    if (explicitlyClosed) return
    stopPingLoop()
    pending.rejectAll(createWsError('WebSocket disconnected', 'DISCONNECTED'))
    scheduleReconnect()
  }

  function handleMessage(event: { data: unknown }): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(event.data))
    } catch {
      return
    }
    if (!isWsEnvelope(parsed)) return

    if (parsed.event === ACK_EVENT) {
      if (!parsed.id) return
      const entry = pending.take(parsed.id)
      if (!entry) return
      const ack = parsed.payload as WsAckPayload | undefined
      if (ack?.ok) entry.resolve(ack)
      else {
        entry.reject(createWsError('Request rejected', ack?.code ?? 'REJECTED'))
      }
      return
    }

    dispatch(parsed.event, parsed.payload)
  }

  function connect(): void {
    const nextSocket = new WebSocketImpl(resolvedUrl)
    socket = nextSocket
    nextSocket.onopen = () => {
      attempt = 0
      clearReconnectTimer()
      setState('open')
      startPingLoop()
    }
    nextSocket.onmessage = (event: any) => handleMessage(event)
    nextSocket.onclose = () => handleDisconnect()
    nextSocket.onerror = () => {}
  }

  connect()

  function on(event: string, handler: (payload: any) => void): () => void {
    let handlers = listeners.get(event)
    if (!handlers) {
      handlers = new Set()
      listeners.set(event, handlers)
    }
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }

  function send(event: string, payload?: unknown): void {
    if (state !== 'open') return
    socket.send(JSON.stringify(buildEnvelope(event, payload)))
  }

  function request(
    event: string,
    payload?: unknown,
    opts?: { timeout?: number },
  ): Promise<WsAckPayload> {
    return new Promise((resolve, reject) => {
      if (state !== 'open') {
        reject(createWsError('WebSocket is not open', 'NOT_OPEN'))
        return
      }
      const id = nextRequestId()
      const timeout = opts?.timeout ?? requestTimeoutMs
      const timer = setTimeout(() => {
        pending.take(id)
        reject(createWsError('WebSocket request timed out', 'TIMEOUT'))
      }, timeout)
      pending.add(id, { resolve, reject, timer })
      socket.send(JSON.stringify(buildEnvelope(event, payload, id)))
    })
  }

  function close(): void {
    if (state === 'closed') return
    explicitlyClosed = true
    clearReconnectTimer()
    stopPingLoop()
    setState('closed')
    pending.rejectAll(createWsError('WebSocket closed', 'CLOSED'))
    socket.close()
  }

  return {
    on,
    send,
    request,
    close,
    get state() {
      return state
    },
  }
}
