import type {
  AssistantMessage,
  Message as PiMessage,
  ToolResultMessage,
  UserMessage,
} from '@earendil-works/pi-ai'
import {
  AGENT_ATTACHMENTS_DIR,
  type AgentHistoryBubble,
  type AgentHistoryToolItem,
  type AgentHistoryUsage,
  FULL_RESULT_TOOLS,
} from '@mx-space/ai'

import { stripSystemReminder, USER_ATTACHMENT_NOTE } from './ai-agent-vfs'

type UserHistoryBubble = Extract<AgentHistoryBubble, { type: 'user' }>

const FULL_RESULT_LIMIT = 4096
const PREVIEW_LENGTH = 80
const OPERATION_KINDS = new Set(['insert', 'replace', 'delete'])

const textOf = (content: ToolResultMessage['content']) =>
  content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')

function isOperationResult(text: string) {
  try {
    const parsed = JSON.parse(text) as { op?: { op?: unknown } }
    return Boolean(parsed?.op && OPERATION_KINDS.has(parsed.op.op as string))
  } catch {
    return false
  }
}

function settleItem(
  item: AgentHistoryToolItem,
  result: ToolResultMessage | undefined,
): AgentHistoryToolItem {
  if (!result) {
    return { ...item, status: 'error', error: 'Tool did not complete' }
  }
  const text = textOf(result.content)
  if (result.isError) return { ...item, status: 'error', error: text }
  const keepFull =
    text.length <= FULL_RESULT_LIMIT ||
    FULL_RESULT_TOOLS.includes(item.toolName) ||
    isOperationResult(text)
  return keepFull
    ? {
        ...item,
        status: 'completed',
        result: text,
        resultPreview: text.slice(0, PREVIEW_LENGTH),
      }
    : {
        ...item,
        status: 'completed',
        resultPreview: text.slice(0, PREVIEW_LENGTH),
        truncated: true,
      }
}

const ATTACHED_FILE_SUFFIX = ` ${USER_ATTACHMENT_NOTE}`

const attachedFiles = (reminder: string) =>
  reminder
    .split('\n')
    .filter(
      (line) =>
        line.startsWith(AGENT_ATTACHMENTS_DIR) &&
        line.endsWith(ATTACHED_FILE_SUFFIX),
    )
    .map((line) => line.slice(0, -ATTACHED_FILE_SUFFIX.length))

function projectUser(message: UserMessage): UserHistoryBubble {
  const blocks = typeof message.content === 'string' ? null : message.content
  const text = blocks
    ? blocks
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
    : (message.content as string)
  const content = stripSystemReminder(text)
  const reminder = text.slice(0, text.length - content.length)
  const bubble: UserHistoryBubble = { type: 'user', content }
  const images = (blocks ?? []).flatMap((block) =>
    block.type === 'image' && /^https?:\/\//.test(block.data)
      ? [{ url: block.data, mimeType: block.mimeType }]
      : [],
  )
  if (images.length) bubble.images = images
  const files = attachedFiles(reminder)
  if (files.length) bubble.files = files
  return bubble
}

function addUsage(
  total: AgentHistoryUsage | undefined,
  usage: AssistantMessage['usage'] | undefined,
): AgentHistoryUsage | undefined {
  if (!usage) return total
  const base = total ?? {
    calls: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
  }
  return {
    calls: base.calls + 1,
    input: base.input + (usage.input ?? 0),
    output: base.output + (usage.output ?? 0),
    cacheRead: base.cacheRead + (usage.cacheRead ?? 0),
    cacheWrite: base.cacheWrite + (usage.cacheWrite ?? 0),
    cost: Math.round((base.cost + (usage.cost?.total ?? 0)) * 1e10) / 1e10,
  }
}

export interface ReviewAnchor {
  batchId: string
  toolCallId: string
}

export function projectTranscriptToBubbles(
  messages: readonly PiMessage[],
  anchors: readonly ReviewAnchor[],
): AgentHistoryBubble[] {
  const results = new Map<string, ToolResultMessage>()
  for (const message of messages) {
    if (message.role === 'toolResult') results.set(message.toolCallId, message)
  }
  const batchesByCall = new Map<string, string[]>()
  for (const { batchId, toolCallId } of anchors) {
    batchesByCall.set(toolCallId, [
      ...(batchesByCall.get(toolCallId) ?? []),
      batchId,
    ])
  }
  const placed = new Set<string>()

  const bubbles: AgentHistoryBubble[] = []
  let turnUsage: AgentHistoryUsage | undefined
  let lastAssistant = -1

  const closeTurn = () => {
    const bubble = bubbles[lastAssistant]
    if (turnUsage && bubble?.type === 'assistant') {
      bubbles[lastAssistant] = { ...bubble, usage: turnUsage }
    }
    turnUsage = undefined
    lastAssistant = -1
  }

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      closeTurn()
      bubbles.push(projectUser(message))
      return
    }
    if (message.role !== 'assistant') return

    turnUsage = addUsage(turnUsage, message.usage)
    const thinking = message.content
      .flatMap((block) => (block.type === 'thinking' ? [block.thinking] : []))
      .join('')
    if (thinking.trim()) {
      bubbles.push({
        type: 'thinking',
        id: `th-${index}`,
        content: thinking,
        rawText: thinking,
        steps: thinking
          .split(/\n{2,}/)
          .map((step) => step.trim())
          .filter(Boolean),
      })
    }
    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
    if (text.trim()) {
      bubbles.push({ type: 'assistant', content: text })
      lastAssistant = bubbles.length - 1
    }
    const calls = message.content.filter((block) => block.type === 'toolCall')
    if (!calls.length) return
    bubbles.push({
      type: 'tool_call_group',
      id: `tcg-${index}`,
      items: calls.map((block) =>
        settleItem(
          {
            id: block.id,
            toolName: block.name,
            params: (block.arguments ?? {}) as Record<string, unknown>,
            status: 'running',
          },
          results.get(block.id),
        ),
      ),
    })
    for (const block of calls) {
      for (const batchId of batchesByCall.get(block.id) ?? []) {
        bubbles.push({ type: 'diff_review', batchId })
        placed.add(batchId)
      }
    }
  })
  closeTurn()

  for (const { batchId } of anchors) {
    if (!placed.has(batchId)) bubbles.push({ type: 'diff_review', batchId })
  }
  return bubbles
}
