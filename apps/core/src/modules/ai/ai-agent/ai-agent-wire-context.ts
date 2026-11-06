import {
  AGENT_CONTEXT_MISSING,
  AGENT_FILE_BASE_MISMATCH,
  type AgentFileFrame,
  type AgentFileSnapshot,
  type AgentToolSchema,
  applyFilePatch,
  hashAgentText,
  hashAgentValue,
} from '@mx-space/ai'

export type WireResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      code: typeof AGENT_CONTEXT_MISSING
      missing: Array<'system' | 'tools'>
    }
  | { ok: false; code: typeof AGENT_FILE_BASE_MISMATCH; paths: string[] }
  | { ok: false; code: 'VALIDATION_FAILED' }

export interface StaticFrame {
  systemHash: string
  system?: string[]
  toolsHash: string
  tools?: AgentToolSchema[]
}

export interface AgentWireContext {
  resolveStatic: (
    frame: StaticFrame,
  ) => Promise<WireResult<{ system: string[]; tools: AgentToolSchema[] }>>
  resolveFiles: (
    conversationKey: string,
    frames: readonly AgentFileFrame[],
  ) => Promise<WireResult<AgentFileSnapshot[]>>
  moveBaseline: (from: string, to: string) => void
}

interface BaselineEntry {
  content: string
  hash: string
}

export function createAgentWireContext(): AgentWireContext {
  const statics = new Map<string, unknown>()
  const baselines = new Map<string, Map<string, BaselineEntry>>()

  const admit = async <T>(hash: string, value: T | undefined) => {
    if (value === undefined) {
      return statics.has(hash)
        ? { found: true as const, value: statics.get(hash) as T }
        : { found: false as const }
    }
    if ((await hashAgentValue(value)) !== hash)
      return { invalid: true as const }
    statics.set(hash, value)
    return { found: true as const, value }
  }

  return {
    resolveStatic: async (frame) => {
      const system = await admit(frame.systemHash, frame.system)
      const tools = await admit(frame.toolsHash, frame.tools)
      if ('invalid' in system || 'invalid' in tools) {
        return { ok: false, code: 'VALIDATION_FAILED' }
      }
      const missing: Array<'system' | 'tools'> = []
      if (!system.found) missing.push('system')
      if (!tools.found) missing.push('tools')
      if (!system.found || !tools.found) {
        return { ok: false, code: AGENT_CONTEXT_MISSING, missing }
      }
      return { ok: true, value: { system: system.value, tools: tools.value } }
    },

    resolveFiles: async (conversationKey, frames) => {
      const baseline = baselines.get(conversationKey) ?? new Map()
      const resolved: AgentFileSnapshot[] = []
      const updates = new Map<string, BaselineEntry>()
      const mismatched: string[] = []

      for (const frame of frames) {
        const known = baseline.get(frame.path)
        let content: string | null = null
        if ('content' in frame) {
          content = frame.content
        } else if ('patch' in frame) {
          content =
            known && known.hash === frame.baseHash
              ? applyFilePatch(known.content, frame.patch)
              : null
        } else if (known && known.hash === frame.hash) {
          content = known.content
        }
        if (content === null) {
          mismatched.push(frame.path)
          continue
        }
        resolved.push(
          frame.attach === undefined
            ? { path: frame.path, content }
            : { path: frame.path, attach: frame.attach, content },
        )
        updates.set(frame.path, { content, hash: await hashAgentText(content) })
      }

      if (mismatched.length) {
        return { ok: false, code: AGENT_FILE_BASE_MISMATCH, paths: mismatched }
      }
      for (const [path, entry] of updates) baseline.set(path, entry)
      baselines.set(conversationKey, baseline)
      return { ok: true, value: resolved }
    },

    moveBaseline: (from, to) => {
      const baseline = baselines.get(from)
      if (!baseline) return
      baselines.delete(from)
      baselines.set(to, baseline)
    },
  }
}
