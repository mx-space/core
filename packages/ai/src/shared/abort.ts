export function createAbortError(msg = 'Task aborted'): Error {
  return Object.assign(new Error(msg), { name: 'AbortError' })
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError()
}
