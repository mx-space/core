export interface PersistenceQueue<TSnapshot, TResult> {
  enqueue: (snapshot: TSnapshot) => Promise<TResult | null>
  flush: () => Promise<TResult | null>
  getGeneration: () => number
  hasPending: () => boolean
}

interface CreatePersistenceQueueOptions<TSnapshot, TResult> {
  save: (snapshot: TSnapshot) => Promise<TResult>
}

export function createPersistenceQueue<TSnapshot, TResult>({
  save,
}: CreatePersistenceQueueOptions<TSnapshot, TResult>): PersistenceQueue<
  TSnapshot,
  TResult
> {
  let active: Promise<TResult | null> | null = null
  let generation = 0
  let pending: TSnapshot | null = null

  const drain = async (): Promise<TResult | null> => {
    let result: TResult | null = null

    while (pending !== null) {
      const snapshot = pending
      pending = null
      const requestGeneration = ++generation
      const next = await save(snapshot)
      if (requestGeneration === generation) result = next
    }

    return result
  }

  const ensureDrain = () => {
    if (!active) {
      active = drain().finally(() => {
        active = null
      })
    }
    return active
  }

  return {
    enqueue(snapshot) {
      pending = snapshot
      return ensureDrain()
    },
    flush() {
      return active ?? Promise.resolve(null)
    },
    getGeneration() {
      return generation
    },
    hasPending() {
      return active !== null || pending !== null
    },
  }
}
