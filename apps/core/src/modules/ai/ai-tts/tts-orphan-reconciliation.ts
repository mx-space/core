export const TTS_ORPHAN_PREFIX = 'tts/'
// A crash between an object's upload and its row commit leaves a real gap,
// but it is always sub-second; an hour floor guarantees this pass never
// races a concurrent generation run that is still mid-chunk.
export const TTS_ORPHAN_MIN_AGE_MS = 60 * 60 * 1000

export interface TtsOrphanCandidate {
  storageBackend: 's3' | 'local'
  storageKey: string
  lastModified: Date
}

export interface ReconcileTtsOrphansInput {
  candidates: TtsOrphanCandidate[]
  knownStorageKeys: Set<string>
  minAgeMs: number
  now: number
  deleteObject: (backend: 's3' | 'local', key: string) => Promise<void>
  onDeleteFailure: (candidate: TtsOrphanCandidate, error: Error) => void
}

export async function reconcileTtsOrphans(
  input: ReconcileTtsOrphansInput,
): Promise<{ deleted: number }> {
  const {
    candidates,
    knownStorageKeys,
    minAgeMs,
    now,
    deleteObject,
    onDeleteFailure,
  } = input

  let deleted = 0
  for (const candidate of candidates) {
    if (knownStorageKeys.has(candidate.storageKey)) continue
    if (now - candidate.lastModified.getTime() < minAgeMs) continue

    try {
      await deleteObject(candidate.storageBackend, candidate.storageKey)
      deleted++
    } catch (error) {
      onDeleteFailure(candidate, error as Error)
    }
  }

  return { deleted }
}

export interface RunTtsOrphanReconciliationDeps {
  listCandidates: () => Promise<TtsOrphanCandidate[] | null>
  findKnownStorageKeys: () => Promise<Set<string>>
  deleteObject: (backend: 's3' | 'local', key: string) => Promise<void>
  onDeleteFailure: (candidate: TtsOrphanCandidate, error: Error) => void
}

export async function runTtsOrphanReconciliation(
  deps: RunTtsOrphanReconciliationDeps,
): Promise<{ deleted: number }> {
  const candidates = await deps.listCandidates()
  if (!candidates) return { deleted: 0 }

  return reconcileTtsOrphans({
    candidates,
    knownStorageKeys: await deps.findKnownStorageKeys(),
    minAgeMs: TTS_ORPHAN_MIN_AGE_MS,
    now: Date.now(),
    deleteObject: deps.deleteObject,
    onDeleteFailure: deps.onDeleteFailure,
  })
}
