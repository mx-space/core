import { EphemeralStore } from 'loro-crdt'

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

export type PresenceUser = {
  avatar: string | null
  id: string
  name: string
}

export type CaretPoint = {
  id: string
  offset: number
}

type PresenceState = {
  anchor: CaretPoint | null
  color: string
  focus: CaretPoint | null
  user: PresenceUser
}

export type RemotePresence = PresenceState & { key: string }

const colorOf = (key: string) => {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

export function createCollabPresence(options: {
  refreshMs?: number
  send: (bytes: Uint8Array) => void
  timeoutMs?: number
}) {
  const store = new EphemeralStore<Record<string, PresenceState>>(
    options.timeoutMs ?? 30_000,
  )
  const listeners = new Set<(remotes: RemotePresence[]) => void>()
  let self: string | null = null
  let refresh: ReturnType<typeof setInterval> | undefined

  const remotes = (): RemotePresence[] =>
    Object.entries(store.getAllStates())
      .filter(
        (entry): entry is [string, PresenceState] =>
          entry[0] !== self && Boolean(entry[1]),
      )
      .map(([key, state]) => ({ ...state, key }))
      .sort((left, right) => left.key.localeCompare(right.key))

  const unsubscribe = store.subscribe(() => {
    const current = remotes()
    for (const listener of listeners) listener(current)
  })

  const publish = () => {
    if (self && store.get(self)) options.send(store.encode(self))
  }

  const update = (patch: Partial<PresenceState>) => {
    if (!self) return
    const current = store.get(self)
    if (!current) return
    store.set(self, { ...current, ...patch })
    publish()
  }

  return {
    announce: publish,
    apply: (bytes: Uint8Array) => store.apply(bytes),
    dispose: () => {
      clearInterval(refresh)
      unsubscribe()
      listeners.clear()
      store.destroy()
    },
    remotes,
    remove: (key: string) => {
      if (key !== self) store.delete(key)
    },
    setCursor: (anchor: CaretPoint | null, focus: CaretPoint | null) =>
      update({ anchor, focus }),
    start: (key: string, user: PresenceUser) => {
      const previous = self ? store.get(self) : undefined
      if (self && self !== key) store.delete(self)
      self = key
      store.set(key, {
        anchor: previous?.anchor ?? null,
        color: colorOf(key),
        focus: previous?.focus ?? null,
        user,
      })
      publish()
      clearInterval(refresh)
      refresh = setInterval(() => {
        const current = self ? store.get(self) : undefined
        if (current && self) store.set(self, current)
        publish()
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
