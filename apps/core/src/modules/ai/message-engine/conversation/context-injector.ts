import { composeSystemPrompt, Conversation } from './conversation'

export interface ContextInjector {
  name: string
  position: 'system' | 'context'
  build: () => string | null | undefined
}

export function buildPrefix(injectors: ContextInjector[]): {
  systemPrompt: string
  contextMessage: string | null
} {
  const seen = new Set<string>()
  for (const injector of injectors) {
    if (seen.has(injector.name)) {
      throw new Error(`duplicate context injector: ${injector.name}`)
    }
    seen.add(injector.name)
  }
  const built = injectors.map((injector) => ({
    injector,
    text: injector.build()?.trim() || null,
  }))
  const systemPrompt = composeSystemPrompt(
    built
      .filter(({ injector }) => injector.position === 'system')
      .map(({ text }) => text),
  )
  const contextBlocks = built
    .filter(({ injector, text }) => injector.position === 'context' && text)
    .map(({ text }) => text as string)
  return {
    systemPrompt,
    contextMessage:
      contextBlocks.length > 0 ? contextBlocks.join('\n\n') : null,
  }
}

export function seedConversation(injectors: ContextInjector[]): Conversation {
  const { systemPrompt, contextMessage } = buildPrefix(injectors)
  const conversation = new Conversation(systemPrompt)
  if (contextMessage) conversation.appendUser(contextMessage)
  return conversation
}
