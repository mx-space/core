import type { AgentPersistedMessage } from './message-normalizer'
import type { AgentToolDefinition } from './turn-loop'

export type DryRunApprovalValidation =
  | { args: Record<string, unknown>; ok: true }
  | { reason: string; ok: false }

export async function validateDryRunApproval(
  message: AgentPersistedMessage,
  tool: AgentToolDefinition,
): Promise<DryRunApprovalValidation> {
  const args =
    message.arguments && typeof message.arguments === 'object'
      ? (message.arguments as Record<string, unknown>)
      : {}

  if (!tool.dryRun) return { args, ok: true }

  const currentDryRun = await tool.dryRun(args, {
    arguments: args,
    id: String(message.toolCallId ?? ''),
    name: tool.manifest.name,
  })

  if (currentDryRun.dryRunHash !== message.dryRunHash) {
    return {
      ok: false,
      reason: 'Dry run changed. Run the request again before approval.',
    }
  }

  if (currentDryRun.blockingReasons?.length) {
    return {
      ok: false,
      reason: currentDryRun.blockingReasons.join('\n'),
    }
  }

  return { args, ok: true }
}
