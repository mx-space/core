import { Data } from 'effect'

// ---------------------------------------------------------------------------
// TaggedError tree (one class per legacy MxsErrorCode entry)
// ---------------------------------------------------------------------------

// auth.*
export class AuthMissing extends Data.TaggedError('AuthMissing')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class AuthExpired extends Data.TaggedError('AuthExpired')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class AuthDenied extends Data.TaggedError('AuthDenied')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class AuthProbe extends Data.TaggedError('AuthProbe')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

// network.*
export class NetworkTimeout extends Data.TaggedError('NetworkTimeout')<{
  readonly message?: string
  readonly url?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class NetworkDns extends Data.TaggedError('NetworkDns')<{
  readonly message?: string
  readonly host?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class NetworkRefused extends Data.TaggedError('NetworkRefused')<{
  readonly message?: string
  readonly url?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

// validation.*
export class ValidationFailed extends Data.TaggedError('ValidationFailed')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class ValidationXml extends Data.TaggedError('ValidationXml')<{
  readonly message?: string
  readonly line?: number
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

export class ValidationJson extends Data.TaggedError('ValidationJson')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

// server.error
export class ServerError extends Data.TaggedError('ServerError')<{
  readonly message?: string
  readonly status?: number
  readonly details?: unknown
  readonly hint?: string
}> {}

// resource.not_found
export class ResourceNotFound extends Data.TaggedError('ResourceNotFound')<{
  readonly message?: string
  readonly kind?: string
  readonly ref?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

// config.*
export class ConfigMissingApiUrl extends Data.TaggedError(
  'ConfigMissingApiUrl',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class ConfigMissingToken extends Data.TaggedError('ConfigMissingToken')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class ConfigMigrationFailed extends Data.TaggedError(
  'ConfigMigrationFailed',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

// profile.*
export class ProfileNotFound extends Data.TaggedError('ProfileNotFound')<{
  readonly message?: string
  readonly name?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class ProfileNoneActive extends Data.TaggedError('ProfileNoneActive')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class ProfileInvalidName extends Data.TaggedError('ProfileInvalidName')<{
  readonly message?: string
  readonly name?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class WriteRequiresExplicit extends Data.TaggedError(
  'WriteRequiresExplicit',
)<{
  readonly message?: string
  readonly profile?: string
  readonly apiUrl?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

// update.*
export class UpdateDevEnvironment extends Data.TaggedError(
  'UpdateDevEnvironment',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class UpdateTransientInstall extends Data.TaggedError(
  'UpdateTransientInstall',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class UpdatePmUnknown extends Data.TaggedError('UpdatePmUnknown')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class UpdateRegistryUnreachable extends Data.TaggedError(
  'UpdateRegistryUnreachable',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class UpdateNodeIncompatible extends Data.TaggedError(
  'UpdateNodeIncompatible',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class UpdateSpawnFailed extends Data.TaggedError('UpdateSpawnFailed')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class UpdatePermissionDenied extends Data.TaggedError(
  'UpdatePermissionDenied',
)<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

// argv.*
export class ArgvParse extends Data.TaggedError('ArgvParse')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

// skill.*
export class ChapterNotFound extends Data.TaggedError('ChapterNotFound')<{
  readonly message?: string
  readonly slug?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class SkillCorpusEmpty extends Data.TaggedError('SkillCorpusEmpty')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

// ai.*
export class AiTaskCreateFailed extends Data.TaggedError('AiTaskCreateFailed')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

export class AiTaskFailed extends Data.TaggedError('AiTaskFailed')<{
  readonly message?: string
  readonly taskId?: string
  readonly status?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

export class AiRecordNotFound extends Data.TaggedError('AiRecordNotFound')<{
  readonly message?: string
  readonly kind?: string
  readonly ref?: string
  readonly details?: unknown
  readonly hint?: string
}> {}

// generic
export class Generic extends Data.TaggedError('Generic')<{
  readonly message?: string
  readonly details?: unknown
  readonly hint?: string
  readonly cause?: unknown
}> {}

// ---------------------------------------------------------------------------
// Union & tag table
// ---------------------------------------------------------------------------

export type CliError =
  | AuthMissing
  | AuthExpired
  | AuthDenied
  | AuthProbe
  | NetworkTimeout
  | NetworkDns
  | NetworkRefused
  | ValidationFailed
  | ValidationXml
  | ValidationJson
  | ServerError
  | ResourceNotFound
  | ConfigMissingApiUrl
  | ConfigMissingToken
  | ConfigMigrationFailed
  | ProfileNotFound
  | ProfileNoneActive
  | ProfileInvalidName
  | WriteRequiresExplicit
  | UpdateDevEnvironment
  | UpdateTransientInstall
  | UpdatePmUnknown
  | UpdateRegistryUnreachable
  | UpdateNodeIncompatible
  | UpdateSpawnFailed
  | UpdatePermissionDenied
  | ArgvParse
  | ChapterNotFound
  | SkillCorpusEmpty
  | AiTaskCreateFailed
  | AiTaskFailed
  | AiRecordNotFound
  | Generic

export type CliErrorTag = CliError['_tag']

// Wire-format `code` strings. MUST stay byte-equal to the legacy
// `MxsErrorCode` table in `src/core/errors.ts` so envelope output and
// existing test fixtures keep matching.
export const tagToCode: Record<CliErrorTag, string> = {
  AuthMissing: 'auth.missing',
  AuthExpired: 'auth.expired',
  AuthDenied: 'auth.denied',
  AuthProbe: 'auth.probe',
  NetworkTimeout: 'network.timeout',
  NetworkDns: 'network.dns',
  NetworkRefused: 'network.refused',
  ValidationFailed: 'validation.failed',
  ValidationXml: 'validation.xml',
  ValidationJson: 'validation.json',
  ServerError: 'server.error',
  ResourceNotFound: 'resource.not_found',
  ConfigMissingApiUrl: 'config.missing.api_url',
  ConfigMissingToken: 'config.missing.token',
  ConfigMigrationFailed: 'config.migration.failed',
  ProfileNotFound: 'profile.not_found',
  ProfileNoneActive: 'profile.none_active',
  ProfileInvalidName: 'profile.invalid_name',
  WriteRequiresExplicit: 'profile.write_requires_explicit',
  UpdateDevEnvironment: 'update.dev_environment',
  UpdateTransientInstall: 'update.transient_install',
  UpdatePmUnknown: 'update.pm_unknown',
  UpdateRegistryUnreachable: 'update.registry_unreachable',
  UpdateNodeIncompatible: 'update.node_incompatible',
  UpdateSpawnFailed: 'update.spawn_failed',
  UpdatePermissionDenied: 'update.permission_denied',
  ArgvParse: 'argv.parse',
  ChapterNotFound: 'skill.chapter_not_found',
  SkillCorpusEmpty: 'skill.corpus_empty',
  AiTaskCreateFailed: 'ai.task.create_failed',
  AiTaskFailed: 'ai.task.failed',
  AiRecordNotFound: 'ai.record.not_found',
  Generic: 'generic',
}

export const codeForTag = (tag: CliErrorTag): string => tagToCode[tag]

// ---------------------------------------------------------------------------
// Exit codes — mirror legacy `exitCodeForError`
// ---------------------------------------------------------------------------

export const exitCodeForTag = (tag: CliErrorTag): number => {
  switch (tag) {
    case 'ArgvParse': {
      return 2
    }
    case 'AuthMissing':
    case 'AuthExpired':
    case 'AuthDenied':
    case 'AuthProbe': {
      return 3
    }
    case 'NetworkTimeout':
    case 'NetworkDns':
    case 'NetworkRefused':
    case 'WriteRequiresExplicit':
    case 'ProfileNoneActive': {
      return 4
    }
    case 'ValidationFailed':
    case 'ValidationXml':
    case 'ValidationJson':
    case 'ProfileInvalidName':
    case 'ConfigMissingApiUrl':
    case 'ConfigMissingToken': {
      return 5
    }
    case 'ServerError': {
      return 6
    }
    case 'ResourceNotFound':
    case 'ChapterNotFound':
    case 'AiRecordNotFound': {
      return 7
    }
    case 'UpdatePmUnknown': {
      return 70
    }
    case 'UpdatePermissionDenied': {
      return 73
    }
    case 'UpdateRegistryUnreachable': {
      return 75
    }
    default: {
      return 1
    }
  }
}

export const exitCodeForError = (err: unknown): number => {
  if (
    typeof err === 'object' &&
    err !== null &&
    '_tag' in err &&
    typeof (err as { _tag: unknown })._tag === 'string' &&
    (err as { _tag: string })._tag in tagToCode
  ) {
    return exitCodeForTag((err as { _tag: CliErrorTag })._tag)
  }
  return 1
}

// ---------------------------------------------------------------------------
// Default messages (used when an error is constructed without one)
// ---------------------------------------------------------------------------

const defaultMessages: Record<CliErrorTag, string> = {
  AuthMissing: 'not authenticated',
  AuthExpired: 'authentication required',
  AuthDenied: 'permission denied',
  AuthProbe: 'cannot detect auth endpoint',
  NetworkTimeout: 'network request timed out',
  NetworkDns: 'dns lookup failed',
  NetworkRefused: 'connection refused',
  ValidationFailed: 'validation failed',
  ValidationXml: 'failed to parse LiteXML',
  ValidationJson: 'failed to parse JSON',
  ServerError: 'server error',
  ResourceNotFound: 'resource not found',
  ConfigMissingApiUrl: 'API URL is not configured',
  ConfigMissingToken: 'auth token is not configured',
  ConfigMigrationFailed: 'legacy config migration failed',
  ProfileNotFound: 'profile not found',
  ProfileNoneActive: 'no active profile',
  ProfileInvalidName: 'invalid profile name',
  WriteRequiresExplicit:
    'write blocked: active profile is production; pass --profile explicitly',
  UpdateDevEnvironment: 'cannot self-update from a dev environment',
  UpdateTransientInstall: 'cannot self-update from a transient install',
  UpdatePmUnknown: 'cannot determine package manager for self-update',
  UpdateRegistryUnreachable: 'npm registry is unreachable',
  UpdateNodeIncompatible: 'installed Node.js does not satisfy required engine',
  UpdateSpawnFailed: 'failed to spawn package manager',
  UpdatePermissionDenied: 'permission denied while writing to install prefix',
  ArgvParse: 'failed to parse arguments',
  ChapterNotFound: 'skill chapter not found',
  SkillCorpusEmpty: 'skill corpus is empty',
  AiTaskCreateFailed: 'failed to create AI task',
  AiTaskFailed: 'AI task did not succeed',
  AiRecordNotFound: 'AI record not found',
  Generic: 'mxs error',
}

export const defaultMessageFor = (tag: CliErrorTag): string =>
  defaultMessages[tag]

// ---------------------------------------------------------------------------
// Wire-format envelope (matches legacy `MxsError.toJSON()`)
// ---------------------------------------------------------------------------

export interface ErrorEnvelope {
  readonly ok: false
  readonly code: string
  readonly message: string
  readonly details?: unknown
  readonly hint?: string
}

const hasOwn = <K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> =>
  typeof obj === 'object' && obj !== null && key in obj

export const toErrorEnvelope = (err: CliError): ErrorEnvelope => {
  const tag = err._tag
  const code = codeForTag(tag)
  const message =
    hasOwn(err, 'message') && typeof err.message === 'string' && err.message
      ? err.message
      : defaultMessageFor(tag)
  const envelope: {
    ok: false
    code: string
    message: string
    details?: unknown
    hint?: string
  } = { ok: false as const, code, message }
  if (hasOwn(err, 'details') && err.details !== undefined) {
    envelope.details = err.details
  }
  if (
    hasOwn(err, 'hint') &&
    typeof err.hint === 'string' &&
    err.hint.length > 0
  ) {
    envelope.hint = err.hint
  }
  return envelope as ErrorEnvelope
}
