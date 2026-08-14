export interface WsBackoffOptions {
  baseMs?: number
  maxMs?: number
}

export const DEFAULT_BACKOFF_BASE_MS = 500
export const DEFAULT_BACKOFF_MAX_MS = 30_000

export function computeReconnectDelayMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt)
  return Math.random() * cap
}
