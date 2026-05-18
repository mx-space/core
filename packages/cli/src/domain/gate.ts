export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'

export interface ResolvedGateInput {
  readonly apiUrl: string
  readonly profileName: string | null
  readonly isProduction: boolean
  readonly profileExplicit: boolean
  readonly urlOverridden: boolean
}

export interface GateDecision {
  readonly allow: boolean
  readonly message?: string
  readonly hint?: string
}

const SAFE_METHODS = new Set<HttpMethod>(['GET', 'HEAD', 'OPTIONS'])

export const decideWriteGate = (
  resolved: ResolvedGateInput,
  method: HttpMethod,
): GateDecision => {
  if (SAFE_METHODS.has(method)) return { allow: true }
  if (!resolved.isProduction) return { allow: true }
  if (resolved.profileExplicit) return { allow: true }
  if (resolved.urlOverridden) return { allow: true }

  const name = resolved.profileName ?? 'unknown'
  const url = resolved.apiUrl

  return {
    allow: false,
    message: `write blocked: active profile '${name}' (${url}) is production`,
    hint: `active profile '${name}' is production; retry with --profile ${name} or MXS_PROFILE=${name}`,
  }
}
