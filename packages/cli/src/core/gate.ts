import type { ResolvedConfig } from './config-store'
import { MxsErrorCode } from './errors'

export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'

export interface GateDecision {
  allow: boolean
  code?: 'profile.write_requires_explicit'
  message?: string
  hint?: string
}

const SAFE_METHODS = new Set<HttpMethod>(['GET', 'HEAD', 'OPTIONS'])

export function decideWriteGate(
  resolved: ResolvedConfig,
  method: HttpMethod,
): GateDecision {
  if (SAFE_METHODS.has(method)) {
    return { allow: true }
  }
  if (!resolved.isProduction) {
    return { allow: true }
  }
  if (resolved.profileExplicit) {
    return { allow: true }
  }
  if (resolved.urlOverridden) {
    return { allow: true }
  }

  const name = resolved.profileName ?? 'unknown'
  const url = resolved.apiUrl

  return {
    allow: false,
    code: MxsErrorCode.ProfileWriteRequiresExplicit,
    message: `write blocked: active profile '${name}' (${url}) is production`,
    hint: `active profile '${name}' is production; retry with --profile ${name} or MXS_PROFILE=${name}`,
  }
}
