import {
  type AgentFileFrame,
  type AgentFileSnapshot,
  type AgentToolSchema,
  createFilePatch,
  hashAgentText,
  hashAgentValue,
} from '@mx-space/ai'

export interface StaticFrame {
  systemHash: string
  system?: string[]
  toolsHash: string
  tools?: AgentToolSchema[]
}

export interface AgentWireClient {
  encodeStatic: (
    system: string[],
    tools: AgentToolSchema[],
  ) => Promise<StaticFrame>
  commitStatic: (frame: StaticFrame) => void
  forgetStatic: () => void
  encodeFiles: (
    conversationId: string | null,
    files: readonly AgentFileSnapshot[],
    options?: { full?: ReadonlySet<string> },
  ) => Promise<AgentFileFrame[]>
  commitFiles: (
    conversationId: string,
    files: readonly AgentFileSnapshot[],
  ) => void
  reset: () => void
}

const withAttach = <T extends { path: string }>(
  frame: T,
  attach: boolean | undefined,
) => (attach === undefined ? frame : { ...frame, attach })

export function createAgentWireClient(): AgentWireClient {
  const acknowledged = new Set<string>()
  const baselines = new Map<string, Map<string, string>>()

  return {
    encodeStatic: async (system, tools) => {
      const systemHash = await hashAgentValue(system)
      const toolsHash = await hashAgentValue(tools)
      return {
        systemHash,
        ...(acknowledged.has(systemHash) ? {} : { system }),
        toolsHash,
        ...(acknowledged.has(toolsHash) ? {} : { tools }),
      }
    },

    commitStatic: (frame) => {
      acknowledged.add(frame.systemHash)
      acknowledged.add(frame.toolsHash)
    },

    forgetStatic: () => acknowledged.clear(),

    encodeFiles: async (conversationId, files, options) => {
      const baseline = conversationId
        ? baselines.get(conversationId)
        : undefined
      return Promise.all(
        files.map(async ({ attach, content, path }) => {
          const base = baseline?.get(path)
          if (base === undefined || options?.full?.has(path)) {
            return withAttach({ content, path }, attach)
          }
          if (base === content) {
            return withAttach(
              { hash: await hashAgentText(content), path },
              attach,
            )
          }
          return withAttach(
            {
              baseHash: await hashAgentText(base),
              patch: createFilePatch(base, content),
              path,
            },
            attach,
          )
        }),
      )
    },

    commitFiles: (conversationId, files) => {
      const baseline = baselines.get(conversationId) ?? new Map()
      for (const { content, path } of files) baseline.set(path, content)
      baselines.set(conversationId, baseline)
    },

    reset: () => {
      acknowledged.clear()
      baselines.clear()
    },
  }
}
