import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'

import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { SessionHeader } from './SessionHeader'
import type { WriteAgentController } from './use-write-agent'

interface AgentPanelProps {
  agent: WriteAgentController
}

const EXPORT_SCHEMA_VERSION = 1

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function AgentPanel({ agent }: AgentPanelProps) {
  const [input, setInput] = useState('')
  const { t } = useI18n()

  const handleExport = useCallback(() => {
    const state = agent.store.getState()
    if (!state.bubbles.length && !state.reviewState?.batches.length) {
      toast.message(t('write.agent.toast.exportEmpty'))
      return
    }

    const activeSession =
      agent.sessions.find((s) => s.id === agent.activeSessionId) ?? null
    const exportedAt = new Date().toISOString()
    const sessionShort = (agent.activeSessionId ?? 'ephemeral').slice(0, 8)
    const filename = `agent-session-${sessionShort}-${exportedAt.replaceAll(/[.:]/g, '-')}.json`

    downloadJson(
      {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt,
        session: activeSession,
        selectedModel: agent.selectedModel,
        status: state.status,
        bubbles: state.bubbles,
        reviewState: state.reviewState,
        pinnedSelection: state.pinnedSelection,
        liveSelection: state.liveSelection,
      },
      filename,
    )

    toast.success(t('write.agent.toast.exportSuccess'))
  }, [agent, t])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <SessionHeader
        activeSessionId={agent.activeSessionId}
        isLoading={agent.isLoadingSessions}
        loadError={agent.loadSessionsError}
        onCreate={agent.createSession}
        onDelete={agent.deleteSession}
        onExport={handleExport}
        onRename={agent.renameSession}
        onRetryLoad={agent.retryLoadSessions}
        onSwitch={agent.switchSession}
        sessions={agent.sessions}
      />
      <MessageList
        isHydrating={agent.isHydrating}
        onAcceptBatch={agent.acceptBatch}
        onReapplyBatch={agent.reapplyBatch}
        onReapplyToolGroup={agent.reapplyToolGroup}
        onRejectBatch={agent.rejectBatch}
        store={agent.store}
      />
      <ChatComposer
        agentReady={agent.agentReady}
        isLoadingModels={agent.isLoadingModels}
        onAbort={agent.abort}
        onChange={setInput}
        onSelectModel={agent.selectModel}
        onSend={(message) => {
          agent.sendMessage(message)
          setInput('')
        }}
        providerGroups={agent.providerGroups}
        selectedModel={agent.selectedModel}
        store={agent.store}
        value={input}
      />
    </div>
  )
}
