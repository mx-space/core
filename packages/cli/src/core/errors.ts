export const MxsErrorCode = {
  Generic: 'generic',
  ArgvParse: 'argv.parse',
  AuthMissing: 'auth.missing',
  AuthExpired: 'auth.expired',
  AuthDenied: 'auth.denied',
  AuthProbe: 'auth.probe',
  NetworkTimeout: 'network.timeout',
  NetworkDns: 'network.dns',
  NetworkRefused: 'network.refused',
  ValidationFailed: 'validation.failed',
  ValidationXml: 'validation.xml',
  ServerError: 'server.error',
  ResourceNotFound: 'resource.not_found',
  ConfigMissingApiUrl: 'config.missing.api_url',
  ConfigMissingToken: 'config.missing.token',
  ConfigMigrationFailed: 'config.migration.failed',
  ProfileNotFound: 'profile.not_found',
  ProfileNoneActive: 'profile.none_active',
  ProfileInvalidName: 'profile.invalid_name',
  ProfileWriteRequiresExplicit: 'profile.write_requires_explicit',
  UpdateDevEnvironment: 'update.dev_environment',
  UpdateTransientInstall: 'update.transient_install',
  UpdatePmUnknown: 'update.pm_unknown',
  UpdateRegistryUnreachable: 'update.registry_unreachable',
  UpdateNodeIncompatible: 'update.node_incompatible',
  UpdateSpawnFailed: 'update.spawn_failed',
  UpdatePermissionDenied: 'update.permission_denied',
} as const

export type MxsErrorCode =
  | (typeof MxsErrorCode)[keyof typeof MxsErrorCode]
  | (string & {})

export interface MxsErrorOptions {
  code: MxsErrorCode
  message: string
  details?: unknown
  hint?: string
  cause?: unknown
}

export class MxsError extends Error {
  readonly code: MxsErrorCode
  readonly details?: unknown
  readonly hint?: string

  constructor(options: MxsErrorOptions) {
    super(options.message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'MxsError'
    this.code = options.code
    this.details = options.details
    this.hint = options.hint
  }

  toJSON() {
    return {
      ok: false as const,
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
      ...(this.hint === undefined ? {} : { hint: this.hint }),
    }
  }
}

export function exitCodeForError(err: unknown): number {
  if (!(err instanceof MxsError)) return 1
  const code = err.code
  if (code === MxsErrorCode.ArgvParse) return 2
  if (
    code === MxsErrorCode.AuthMissing ||
    code === MxsErrorCode.AuthExpired ||
    code === MxsErrorCode.AuthDenied ||
    code === MxsErrorCode.AuthProbe
  )
    return 3
  if (
    code === MxsErrorCode.NetworkTimeout ||
    code === MxsErrorCode.NetworkDns ||
    code === MxsErrorCode.NetworkRefused ||
    code === MxsErrorCode.ProfileWriteRequiresExplicit || // exit code 4: production write gate refusal
    code === MxsErrorCode.ProfileNoneActive
  )
    return 4
  if (
    code === MxsErrorCode.ValidationFailed ||
    code === MxsErrorCode.ValidationXml ||
    code === MxsErrorCode.ProfileInvalidName ||
    code === MxsErrorCode.ConfigMissingApiUrl ||
    code === MxsErrorCode.ConfigMissingToken
  )
    return 5
  if (code === MxsErrorCode.ServerError) return 6
  if (code === MxsErrorCode.ResourceNotFound) return 7
  if (code === MxsErrorCode.UpdatePmUnknown) return 70
  if (code === MxsErrorCode.UpdatePermissionDenied) return 73
  if (code === MxsErrorCode.UpdateRegistryUnreachable) return 75
  return 1
}
