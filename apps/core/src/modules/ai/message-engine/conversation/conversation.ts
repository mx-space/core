import type {
  AssistantMessage,
  Message as PiMessage,
} from '@earendil-works/pi-ai'

export function composeSystemPrompt(
  sections: Array<string | null | undefined>,
): string {
  return sections
    .map((section) => section?.trimEnd())
    .filter((section): section is string => Boolean(section))
    .join('\n\n')
}

export class Conversation {
  private readonly list: PiMessage[] = []

  constructor(readonly systemPrompt: string) {}

  get messages(): PiMessage[] {
    return [...this.list]
  }

  appendUser(text: string): void {
    this.list.push({ role: 'user', content: text, timestamp: Date.now() })
  }

  appendAssistant(message: AssistantMessage): void {
    this.list.push(message)
  }

  appendToolResult(input: {
    toolCallId: string
    toolName: string
    content: string
    isError: boolean
  }): void {
    this.list.push({
      role: 'toolResult',
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      content: [{ type: 'text', text: input.content }],
      isError: input.isError,
      timestamp: Date.now(),
    })
  }
}
