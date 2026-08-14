import type { WsAckPayload } from './protocol.js'

export interface PendingRequestEntry {
  resolve: (payload: WsAckPayload) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class PendingRequests {
  private readonly entries = new Map<string, PendingRequestEntry>()

  add(id: string, entry: PendingRequestEntry): void {
    this.entries.set(id, entry)
  }

  take(id: string): PendingRequestEntry | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined
    this.entries.delete(id)
    clearTimeout(entry.timer)
    return entry
  }

  rejectAll(error: Error): void {
    const entries = [...this.entries.values()]
    this.entries.clear()
    for (const entry of entries) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
  }
}
