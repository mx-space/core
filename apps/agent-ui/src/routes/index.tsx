import { AgentShell } from '@/components/agent/agent-shell'
import { useSocketSession } from '@/hooks/use-socket'
import {
  handleConfirmRequest,
  handleConfirmResult,
  handleMessage,
  handleSessionState,
  handleToolEvent,
  loadConfig,
  loadSessions,
  useAgentStore,
} from '@/lib/agent-store'
import { useEffect } from 'react'

export function AgentRoute() {
  const { activeSessionId } = useAgentStore()

  useEffect(() => {
    loadConfig()
    loadSessions()
  }, [])

  useSocketSession(activeSessionId, {
    onSessionState: handleSessionState,
    onMessage: handleMessage,
    onToolEvent: handleToolEvent,
    onConfirmRequest: handleConfirmRequest,
    onConfirmResult: handleConfirmResult,
  })

  return <AgentShell />
}
