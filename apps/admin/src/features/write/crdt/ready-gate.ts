export interface ReadyGate {
  once: (attempt: () => Promise<boolean>) => Promise<boolean>
  release: () => void
  wait: (timeoutMs: number) => Promise<boolean>
}

export function createReadyGate(isReady: () => boolean): ReadyGate {
  const waiters = new Set<(ready: boolean) => void>()
  let inFlight: Promise<boolean> | null = null

  return {
    once: (attempt) => {
      inFlight ??= attempt().finally(() => {
        inFlight = null
      })
      return inFlight
    },
    release: () => {
      for (const settle of waiters) settle(true)
    },
    wait: (timeoutMs) => {
      if (isReady()) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        const settle = (ready: boolean) => {
          clearTimeout(timer)
          waiters.delete(settle)
          resolve(ready)
        }
        const timer = setTimeout(() => settle(false), timeoutMs)
        waiters.add(settle)
      })
    },
  }
}
