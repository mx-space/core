import {
  connectSocket,
  joinSession,
  leaveSession,
  onWsMessage,
} from '@/lib/socket'
import {
  BusinessEvents,
  type WsConfirmRequest,
  type WsConfirmResult,
  type WsEnvelope,
  type WsMessagePayload,
  type WsSessionState,
  type WsToolEvent,
} from '@/types/agent'
import { useEffect, useRef } from 'react'

export interface SocketHandlers {
  onSessionState: (data: WsSessionState) => void
  onMessage: (data: WsMessagePayload) => void
  onToolEvent: (data: WsToolEvent) => void
  onConfirmRequest: (data: WsConfirmRequest) => void
  onConfirmResult: (data: WsConfirmResult) => void
}

export function useSocketSession(
  sessionId: string | null,
  handlers: SocketHandlers,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    connectSocket()

    const cleanup = onWsMessage((raw: unknown) => {
      const envelope = raw as WsEnvelope
      if (!envelope?.type) return

      const h = handlersRef.current

      switch (envelope.type) {
        case BusinessEvents.AI_AGENT_SESSION_STATE: {
          h.onSessionState(envelope.data as WsSessionState)
          break
        }
        case BusinessEvents.AI_AGENT_MESSAGE: {
          h.onMessage(envelope.data as WsMessagePayload)
          break
        }
        case BusinessEvents.AI_AGENT_TOOL_EVENT: {
          h.onToolEvent(envelope.data as WsToolEvent)
          break
        }
        case BusinessEvents.AI_AGENT_CONFIRM_REQUEST: {
          h.onConfirmRequest(envelope.data as WsConfirmRequest)
          break
        }
        case BusinessEvents.AI_AGENT_CONFIRM_RESULT: {
          h.onConfirmResult(envelope.data as WsConfirmResult)
          break
        }
      }
    })

    return cleanup
  }, [])

  useEffect(() => {
    if (!sessionId) return

    joinSession(sessionId)
    return () => {
      leaveSession(sessionId)
    }
  }, [sessionId])
}
