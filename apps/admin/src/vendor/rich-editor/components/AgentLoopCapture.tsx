import type {
  AgentStore,
  AgentToolConfig,
  ChatMessage,
  LLMProvider,
} from '@haklex/rich-agent-core'
import { useAgentLoop } from '@haklex/rich-ext-ai-agent'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'
import { useEffect } from 'react'

import type { AgentLitexmlRegistryProvider, AgentLoopHandle } from '../types'

interface AgentLoopCaptureInnerProps {
  editorRef: RefObject<LexicalEditor | null>
  onAgentLoopReady: (loop: AgentLoopHandle | null) => void
  provider: LLMProvider
  store: AgentStore
  tools?: AgentToolConfig[]
  litexmlRegistry?: AgentLitexmlRegistryProvider
  systemMessages?: ChatMessage[]
}

function AgentLoopCaptureInner({
  editorRef,
  onAgentLoopReady,
  provider,
  store,
  tools,
  litexmlRegistry,
  systemMessages,
}: AgentLoopCaptureInnerProps) {
  const loopOptions = {
    provider,
    store,
    tools,
    litexmlRegistry,
    systemMessages,
  }
  const loop = useAgentLoop(loopOptions)
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    onAgentLoopReady(loop)
    return () => onAgentLoopReady(null)
  }, [loop, onAgentLoopReady])

  useEffect(() => {
    editorRef.current = editor
  }, [editor, editorRef])

  return null
}

export interface AgentLoopCaptureProps {
  editorRef: RefObject<LexicalEditor | null>
  onAgentLoopReady: (loop: AgentLoopHandle | null) => void
  provider: LLMProvider | null
  store: AgentStore
  tools?: AgentToolConfig[]
  litexmlRegistry?: AgentLitexmlRegistryProvider
  systemMessages?: ChatMessage[]
}

export function AgentLoopCapture({
  editorRef,
  onAgentLoopReady,
  provider,
  store,
  tools,
  litexmlRegistry,
  systemMessages,
}: AgentLoopCaptureProps) {
  useEffect(() => {
    if (!provider) onAgentLoopReady(null)
  }, [onAgentLoopReady, provider])

  if (!provider) {
    return null
  }
  return (
    <AgentLoopCaptureInner
      editorRef={editorRef}
      onAgentLoopReady={onAgentLoopReady}
      provider={provider}
      store={store}
      tools={tools}
      litexmlRegistry={litexmlRegistry}
      systemMessages={systemMessages}
    />
  )
}
