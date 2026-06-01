export type AgentWireRole =
  | 'assistant'
  | 'assistant_tool_call'
  | 'system'
  | 'tool_result'
  | 'user'

export interface AgentWireMessage extends Record<string, unknown> {
  content?: string
  isError?: boolean
  role: AgentWireRole
  toolCallId?: string
  toolCalls?: Array<Record<string, unknown>>
  toolName?: string
}

export type AgentPersistedMessage = Record<string, unknown>

const UI_ONLY_TYPES = new Set([
  '__agent_review_state__',
  'diff_review',
  'thinking',
  'tool_call_group',
])

const SYSTEM_FRAME_TYPES = new Set([
  'core-system',
  'scene-system',
  'system-reminder',
])

const CONTEXT_FRAME_TYPES = new Set([
  'context-snapshot',
  'document-structure',
  'fresh-context',
  'hint',
])

export function compileAgentMessages(
  messages: AgentPersistedMessage[],
): AgentWireMessage[] {
  return messages.flatMap((message) => {
    const byRole = compileRoleMessage(message)
    if (byRole) return [byRole]

    const byType = compileTypedMessage(message)
    return byType ? [byType] : []
  })
}

export function buildTitleProjection(
  messages: AgentPersistedMessage[],
): AgentWireMessage[] {
  const projection: AgentWireMessage[] = []

  for (const message of compileAgentMessages(messages)) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const content = message.content?.trim()
    if (!content) continue
    projection.push({ role: message.role, content })
    if (
      projection.some((entry) => entry.role === 'user') &&
      projection.some((entry) => entry.role === 'assistant')
    ) {
      break
    }
  }

  return projection
}

function compileRoleMessage(
  message: AgentPersistedMessage,
): AgentWireMessage | null {
  const role = message.role
  if (
    role !== 'assistant' &&
    role !== 'assistant_tool_call' &&
    role !== 'system' &&
    role !== 'tool_result' &&
    role !== 'user'
  ) {
    return null
  }

  if (role === 'assistant_tool_call') {
    return {
      content: readTextContent(message),
      role,
      toolCalls: Array.isArray(message.toolCalls)
        ? (message.toolCalls as Array<Record<string, unknown>>)
        : [],
    }
  }

  if (role === 'tool_result') {
    const toolCallId = readString(message.toolCallId)
    const toolName = readString(message.toolName)
    const content = readTextContent(message)
    if (!toolCallId || !toolName || !content) return null
    return {
      content,
      isError: Boolean(message.isError),
      role,
      toolCallId,
      toolName,
    }
  }

  return {
    content: readTextContent(message),
    role,
  }
}

function compileTypedMessage(
  message: AgentPersistedMessage,
): AgentWireMessage | null {
  const type = readString(message.type)
  if (!type || UI_ONLY_TYPES.has(type)) return null

  if (type === 'user') {
    return { role: 'user', content: readTextContent(message) }
  }
  if (type === 'assistant') {
    return { role: 'assistant', content: readTextContent(message) }
  }
  if (type === 'tool_result') {
    return compileLegacyToolResult(message)
  }
  if (SYSTEM_FRAME_TYPES.has(type)) {
    return { role: 'system', content: readFrameContent(message) }
  }
  if (CONTEXT_FRAME_TYPES.has(type)) {
    return { role: 'system', content: readFrameContent(message) }
  }
  if (type === 'tool-result-summary') {
    return compileFrameToolResult(message)
  }
  if (
    type === 'approval' ||
    type === 'dry-run-result' ||
    type === 'execute-result'
  ) {
    return { role: 'user', content: readFrameContent(message) }
  }

  return null
}

function compileLegacyToolResult(
  message: AgentPersistedMessage,
): AgentWireMessage | null {
  const toolCallId = readString(message.toolCallId)
  const toolName = readString(message.toolName ?? message.name)
  const content =
    readString(message.content) ??
    readString(message.summary) ??
    readString(message.result)
  if (!toolCallId || !toolName || !content) return null

  return {
    content,
    isError: message.success === false || Boolean(message.isError),
    role: 'tool_result',
    toolCallId,
    toolName,
  }
}

function compileFrameToolResult(
  message: AgentPersistedMessage,
): AgentWireMessage | null {
  const toolCallId = readString(message.toolCallId)
  const toolName = readString(message.toolName)
  const content = readFrameContent(message)
  if (!toolCallId || !toolName || !content) return null

  return {
    content,
    isError: Boolean(message.isError),
    role: 'tool_result',
    toolCallId,
    toolName,
  }
}

function readFrameContent(message: AgentPersistedMessage) {
  return (
    readString(message.content) ??
    readString(message.summary) ??
    readString(message.text) ??
    JSON.stringify(stripUndefined(message))
  )
}

function readTextContent(message: AgentPersistedMessage) {
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        return readString((item as Record<string, unknown>).text) ?? ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stripUndefined(message: AgentPersistedMessage) {
  return Object.fromEntries(
    Object.entries(message).filter(([, value]) => value !== undefined),
  )
}
