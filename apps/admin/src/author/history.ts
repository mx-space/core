export interface HistoryId {
  peer: string
  counter: number
}

export interface HistoryEntry {
  id: HistoryId
  lamport: number
  timestamp: number
  message?: string
}

export type HistoryKind = 'human' | 'agent' | 'session' | 'restore' | 'other'

export interface HistoryRow {
  id: HistoryId
  kind: HistoryKind
  message: string
  timestamp: number
  count: number
}

const HUMAN_IDLE_GAP_SECONDS = 60

const kindOf = (message = ''): HistoryKind => {
  if (message === 'human') return 'human'
  if (message.startsWith('agent')) return 'agent'
  if (message.startsWith('session')) return 'session'
  if (message.startsWith('restore')) return 'restore'
  return 'other'
}

export function groupHistory(entries: HistoryEntry[]): HistoryRow[] {
  const rows: HistoryRow[] = []
  let oldestInGroup = 0
  for (const entry of entries) {
    const kind = kindOf(entry.message)
    const last = rows.at(-1)
    if (
      kind === 'human' &&
      last?.kind === 'human' &&
      oldestInGroup - entry.timestamp <= HUMAN_IDLE_GAP_SECONDS
    ) {
      last.count += 1
    } else {
      rows.push({
        id: entry.id,
        kind,
        message: entry.message ?? '',
        timestamp: entry.timestamp,
        count: 1,
      })
    }
    oldestInGroup = entry.timestamp
  }
  return rows
}
