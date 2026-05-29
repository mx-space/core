import type {
  AgentOperation,
  ChatBubble,
  ToolCallGroupItem,
} from '@haklex/rich-agent-core'

export function getAgentBubbleKey(bubble: ChatBubble, index: number) {
  if (bubble.type === 'diff_review') return `diff:${bubble.batchId}`
  if (bubble.type === 'tool_call_group') return `tool-group:${bubble.id}`
  if (bubble.type === 'thinking' && bubble.id) return `thinking:${bubble.id}`
  return `${bubble.type}:${index}`
}

export function isReplayableToolItem(item: ToolCallGroupItem) {
  if (item.status !== 'completed' || !item.result) return false
  try {
    const parsed = JSON.parse(item.result) as { op?: AgentOperation }
    return Boolean(parsed.op && isAgentOperation(parsed.op))
  } catch {
    return false
  }
}

export function extractAgentOperationFromToolItem(item: ToolCallGroupItem) {
  if (!isReplayableToolItem(item) || !item.result) return null
  try {
    const parsed = JSON.parse(item.result) as { op?: AgentOperation }
    return parsed.op && isAgentOperation(parsed.op) ? parsed.op : null
  } catch {
    return null
  }
}

export function isAgentOperation(op: AgentOperation) {
  return op.op === 'insert' || op.op === 'replace' || op.op === 'delete'
}
