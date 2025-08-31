import { useCallback, useEffect, useState } from 'react'

export interface OfflineAction<T = any> {
  id: string
  run: () => Promise<T> | T
}

export const useOfflineQueue = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [pending, setPending] = useState<OfflineAction[]>([])

  const queueAction = useCallback(
    (action: OfflineAction) => {
      if (isOnline) return action.run()
      setPending((prev) => [...prev, action])
      try {
        const stored = JSON.parse(
          localStorage.getItem('offline:queue') || '[]',
        ) as OfflineAction[]
        localStorage.setItem(
          'offline:queue',
          JSON.stringify([...stored, action]),
        )
      } catch {
        // ignore storage errors
      }
      return Promise.resolve()
    },
    [isOnline],
  )

  useEffect(() => {
    const handler = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('offline', handler)
    }
  }, [])

  useEffect(() => {
    if (!isOnline) return
    const flush = async () => {
      let actions: OfflineAction[] = []
      try {
        actions = JSON.parse(localStorage.getItem('offline:queue') || '[]')
      } catch {
        // ignore parse errors
      }
      for (const action of actions) {
        try {
          await action.run()
        } catch {
          // ignore individual action errors
        }
      }
      setPending([])
      try {
        localStorage.removeItem('offline:queue')
      } catch {
        // ignore storage errors
      }
    }
    void flush()
  }, [isOnline])

  return { queueAction, pendingCount: pending.length, isOnline }
}
