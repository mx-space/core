export const PRESENCE_COLORS = [
  '#e5484d',
  '#f76b15',
  '#ffc53d',
  '#30a46c',
  '#12a594',
  '#0090ff',
  '#6e56cf',
  '#d6409f',
] as const

export const AGENT_PRESENCE_COLOR = '#8e4ec6'

export type PresenceUser = {
  avatar: string | null
  id: string
  name: string
}

export type CaretPoint = {
  id: string
  offset: number
}

export type PresenceCaret = {
  anchor: CaretPoint | null
  focus: CaretPoint | null
}

export type PresenceState = PresenceCaret & {
  color: string
  user: PresenceUser
}

export type RemotePresence = PresenceState & { key: string }

export type OutgoingPresence = {
  caret: PresenceCaret | null
  entry?: string
}

export type IncomingPresence = {
  caret: PresenceCaret | null
  connectionId: string
  entry: string | null
  user: PresenceUser
}

const LOCAL_AGENT_USER: PresenceUser = { avatar: null, id: 'agent', name: 'AI' }

const samePoint = (left: CaretPoint | null, right: CaretPoint | null) =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.id === right.id &&
    left.offset === right.offset)

const colorOf = (
  key: string,
  entry: string | null,
  taken: ReadonlySet<string> = new Set(),
) => {
  if (entry?.startsWith('agent:')) return AGENT_PRESENCE_COLOR
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  const start = Math.abs(hash) % PRESENCE_COLORS.length
  for (let step = 0; step < PRESENCE_COLORS.length; step += 1) {
    const color = PRESENCE_COLORS[(start + step) % PRESENCE_COLORS.length]
    if (!taken.has(color)) return color
  }
  return PRESENCE_COLORS[start]
}

const pointOf = (value: unknown): CaretPoint | null => {
  const point = value as CaretPoint | null
  return point && typeof point.id === 'string' && Number.isFinite(point.offset)
    ? { id: point.id, offset: point.offset }
    : null
}

export function createCollabPresence(options: {
  refreshMs?: number
  send: (frame: OutgoingPresence) => void
  timeoutMs?: number
}) {
  const timeoutMs = options.timeoutMs ?? 30_000
  const remote = new Map<string, RemotePresence & { connectionId: string }>()
  const heardAt = new Map<string, number>()
  const extras = new Map<string, PresenceCaret>()
  const listeners = new Set<(remotes: RemotePresence[]) => void>()
  let self: PresenceCaret = { anchor: null, focus: null }
  let started = false
  let timer: ReturnType<typeof setInterval> | undefined

  const remotes = (): RemotePresence[] => {
    const local = [...extras].map(([entry, caret]) => ({
      ...caret,
      color: colorOf(entry, entry),
      key: `local/${entry}`,
      user: LOCAL_AGENT_USER,
    }))
    const others = [...remote.values()].map(
      ({ connectionId: _connectionId, ...peer }) => peer,
    )
    return [...others, ...local].sort((left, right) =>
      left.key.localeCompare(right.key),
    )
  }

  const notify = () => {
    const current = remotes()
    for (const listener of listeners) listener(current)
  }

  const announce = () => {
    if (!started) return
    options.send({ caret: self })
    for (const [entry, caret] of extras) options.send({ caret, entry })
  }

  const expire = () => {
    const now = Date.now()
    let changed = false
    for (const [key, at] of heardAt) {
      if (now - at < timeoutMs) continue
      heardAt.delete(key)
      changed = remote.delete(key) || changed
    }
    if (changed) notify()
  }

  return {
    announce,
    apply: (frame: IncomingPresence) => {
      const key = frame.entry
        ? `${frame.connectionId}/${frame.entry}`
        : frame.connectionId
      if (!frame.caret) {
        heardAt.delete(key)
        if (remote.delete(key)) notify()
        return
      }
      heardAt.set(key, Date.now())
      const taken = new Set(
        [...remote.values()]
          .filter((peer) => peer.key !== key)
          .map((peer) => peer.color),
      )
      remote.set(key, {
        anchor: pointOf(frame.caret.anchor),
        color: remote.get(key)?.color ?? colorOf(key, frame.entry, taken),
        connectionId: frame.connectionId,
        focus: pointOf(frame.caret.focus),
        key,
        user: frame.user,
      })
      notify()
    },
    dispose: () => {
      clearInterval(timer)
      started = false
      listeners.clear()
      remote.clear()
      heardAt.clear()
    },
    remotes,
    removeConnection: (connectionId: string) => {
      let changed = false
      for (const [key, peer] of remote) {
        if (peer.connectionId !== connectionId) continue
        remote.delete(key)
        heardAt.delete(key)
        changed = true
      }
      if (changed) notify()
    },
    setCursor: (anchor: CaretPoint | null, focus: CaretPoint | null) => {
      if (samePoint(self.anchor, anchor) && samePoint(self.focus, focus)) {
        return
      }
      self = { anchor, focus }
      if (started) options.send({ caret: self })
    },
    setExtra: (entry: string, caret: PresenceCaret | null) => {
      if (caret) extras.set(entry, caret)
      else extras.delete(entry)
      if (started) options.send({ caret, entry })
      notify()
    },
    start: () => {
      started = true
      announce()
      clearInterval(timer)
      timer = setInterval(() => {
        announce()
        expire()
      }, options.refreshMs ?? 10_000)
    },
    subscribe: (listener: (remotes: RemotePresence[]) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type CollabPresence = ReturnType<typeof createCollabPresence>
