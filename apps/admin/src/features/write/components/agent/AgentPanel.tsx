import { useState } from 'react'

import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { SessionHeader } from './SessionHeader'
import type { WriteAgentController } from './use-write-agent'

interface AgentPanelProps {
  agent: WriteAgentController
}

export function AgentPanel({ agent }: AgentPanelProps) {
  const [input, setInput] = useState('')

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <SessionHeader
        activeSessionId={agent.activeSessionId}
        isLoading={agent.isLoadingSessions}
        loadError={agent.loadSessionsError}
        onCreate={agent.createSession}
        onDelete={agent.deleteSession}
        onRename={agent.renameSession}
        onRetryLoad={agent.retryLoadSessions}
        onSwitch={agent.switchSession}
        sessions={agent.sessions}
      />
      <MessageList
        isHydrating={agent.isHydrating}
        messages={agent.messages}
        onToolCallEnd={agent.handleToolCallEnd}
        streamStatus={agent.streamStatus}
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
        streamStatus={agent.streamStatus}
        value={input}
      />
    </div>
  )
}
