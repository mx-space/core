import type { UserModel } from '~/models/user'
import type { InitResponse } from '../types/login'

export function isInitEnvelope(
  value: InitResponse | { data?: InitResponse },
): value is { data?: InitResponse } {
  return 'data' in value
}

export function readInitial(owner?: UserModel) {
  return (owner?.name || owner?.username || 'A').slice(0, 1).toUpperCase()
}

export function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}
