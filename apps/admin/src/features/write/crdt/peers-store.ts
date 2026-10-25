import { useSyncExternalStore } from 'react'

import type { RemotePresence } from './collab-presence'

export interface PeersSource {
  get: () => RemotePresence[]
  subscribe: (listener: () => void) => () => void
}

const NONE: RemotePresence[] = []

export function createPeersStore(): PeersSource & {
  set: (peers: RemotePresence[]) => void
} {
  let current = NONE
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (peers) => {
      const next = peers.length ? peers : NONE
      if (next === current) return
      current = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const usePeers = (source: PeersSource) =>
  useSyncExternalStore(source.subscribe, source.get)
