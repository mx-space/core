export interface AgentTurnUsage {
  calls: number
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  cost: number
}

export interface ModelCallUsage {
  input?: number
  cacheRead?: number
  cacheWrite?: number
  output?: number
  cost?: { total?: number }
}

export function addAgentUsage(
  total: AgentTurnUsage | undefined,
  usage: ModelCallUsage | undefined,
): AgentTurnUsage | undefined {
  if (!usage) return total
  const base = total ?? {
    cacheRead: 0,
    cacheWrite: 0,
    calls: 0,
    cost: 0,
    input: 0,
    output: 0,
  }
  return {
    cacheRead: base.cacheRead + (usage.cacheRead ?? 0),
    cacheWrite: base.cacheWrite + (usage.cacheWrite ?? 0),
    calls: base.calls + 1,
    cost: roundCost(base.cost + (usage.cost?.total ?? 0)),
    input: base.input + (usage.input ?? 0),
    output: base.output + (usage.output ?? 0),
  }
}

export function describeAgentUsage(usage: AgentTurnUsage) {
  const prompt = usage.input + usage.cacheRead + usage.cacheWrite
  return {
    cost: usage.cost > 0 ? formatCost(usage.cost) : null,
    hitRate:
      prompt > 0 && usage.cacheRead > 0
        ? `${Math.round((usage.cacheRead / prompt) * 100)}%`
        : null,
    input: formatTokens(prompt),
    output: formatTokens(usage.output),
  }
}

function roundCost(value: number) {
  return Math.round(value * 1e10) / 1e10
}

function formatTokens(value: number) {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${trimZeros((value / 1000).toFixed(1))}k`
  return `${trimZeros((value / 1_000_000).toFixed(2))}M`
}

function formatCost(value: number) {
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`
}

function trimZeros(value: string) {
  return value.replace(/\.?0+$/, '')
}
