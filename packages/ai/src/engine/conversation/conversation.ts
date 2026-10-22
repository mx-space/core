import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { AssistantMessage } from '@earendil-works/pi-ai'
import { createPiMessageEngine } from '@innei/message-engine/adapters/pi'

let conversationSequence = 0

function createConversationId(): string {
  conversationSequence += 1
  return ['mx-core-conversation', Date.now(), conversationSequence].join('-')
}

export class Conversation {
  private readonly engine = createPiMessageEngine({
    initial: undefined,
    services: {},
    sessionId: createConversationId(),
  })
  readonly transformContext = this.engine.createTransformContext({
    step: undefined,
  })

  constructor(readonly systemPrompt: string) {}

  get messages(): AgentMessage[] {
    return this.engine.getMessages()
  }

  append(message: AgentMessage): void {
    this.engine.append([message])
  }

  appendUser(text: string): void {
    this.engine.append([{ role: 'user', content: text, timestamp: Date.now() }])
  }

  appendAssistant(message: AssistantMessage): void {
    this.append(message)
  }

  appendToolResult(input: {
    toolCallId: string
    toolName: string
    content: string
    isError: boolean
  }): void {
    this.engine.append([
      {
        role: 'toolResult',
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        content: [{ type: 'text', text: input.content }],
        isError: input.isError,
        timestamp: Date.now(),
      },
    ])
  }
}
