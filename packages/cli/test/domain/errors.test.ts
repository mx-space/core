import { describe, expect, it } from 'vitest'

import {
  AuthMissing,
  ConfigMissingApiUrl,
  ConfigMissingToken,
  exitCodeForError,
  exitCodeForTag,
  Generic,
  NetworkTimeout,
  ProfileInvalidName,
  ProfileNoneActive,
  ResourceNotFound,
  ServerError,
  toErrorEnvelope,
  UpdatePermissionDenied,
  UpdatePmUnknown,
  UpdateRegistryUnreachable,
  ValidationFailed,
  WriteRequiresExplicit,
  codeForTag,
} from '../../src/domain/errors'

describe('exitCodeForTag', () => {
  it('returns 4 for WriteRequiresExplicit (profile.write_requires_explicit)', () => {
    expect(exitCodeForTag('WriteRequiresExplicit')).toBe(4)
  })

  it('returns 4 for ProfileNoneActive', () => {
    expect(exitCodeForTag('ProfileNoneActive')).toBe(4)
  })

  it('returns 5 for ProfileInvalidName', () => {
    expect(exitCodeForTag('ProfileInvalidName')).toBe(5)
  })

  it('returns 5 for ValidationFailed', () => {
    expect(exitCodeForTag('ValidationFailed')).toBe(5)
  })

  it('returns 5 for ConfigMissingApiUrl / ConfigMissingToken', () => {
    expect(exitCodeForTag('ConfigMissingApiUrl')).toBe(5)
    expect(exitCodeForTag('ConfigMissingToken')).toBe(5)
  })

  it('returns 3 for AuthMissing/Expired/Denied/Probe', () => {
    expect(exitCodeForTag('AuthMissing')).toBe(3)
    expect(exitCodeForTag('AuthExpired')).toBe(3)
    expect(exitCodeForTag('AuthDenied')).toBe(3)
    expect(exitCodeForTag('AuthProbe')).toBe(3)
  })

  it('returns 4 for network.* tags', () => {
    expect(exitCodeForTag('NetworkTimeout')).toBe(4)
    expect(exitCodeForTag('NetworkDns')).toBe(4)
    expect(exitCodeForTag('NetworkRefused')).toBe(4)
  })

  it('returns 6 for ServerError, 7 for ResourceNotFound', () => {
    expect(exitCodeForTag('ServerError')).toBe(6)
    expect(exitCodeForTag('ResourceNotFound')).toBe(7)
  })

  it('returns sysexits codes for update sub-errors', () => {
    expect(exitCodeForTag('UpdatePmUnknown')).toBe(70)
    expect(exitCodeForTag('UpdatePermissionDenied')).toBe(73)
    expect(exitCodeForTag('UpdateRegistryUnreachable')).toBe(75)
  })

  it('returns 2 for ArgvParse', () => {
    expect(exitCodeForTag('ArgvParse')).toBe(2)
  })

  it('returns 1 for Generic and unknown', () => {
    expect(exitCodeForTag('Generic')).toBe(1)
  })
})

describe('exitCodeForError', () => {
  it('reads the _tag from a CliError instance', () => {
    const err = new WriteRequiresExplicit({ message: 'blocked' })
    expect(exitCodeForError(err)).toBe(4)
  })

  it('returns 1 for a plain Error', () => {
    expect(exitCodeForError(new Error('boom'))).toBe(1)
  })

  it('returns 1 for non-error values', () => {
    expect(exitCodeForError('string error')).toBe(1)
    expect(exitCodeForError(null)).toBe(1)
    expect(exitCodeForError(undefined)).toBe(1)
    expect(exitCodeForError(42)).toBe(1)
  })

  it('returns 1 for an object with an unknown _tag', () => {
    expect(exitCodeForError({ _tag: 'NotAKnownTag' })).toBe(1)
  })
})

describe('codeForTag — wire-format strings', () => {
  it('preserves legacy MxsErrorCode string values', () => {
    expect(codeForTag('AuthMissing')).toBe('auth.missing')
    expect(codeForTag('WriteRequiresExplicit')).toBe(
      'profile.write_requires_explicit',
    )
    expect(codeForTag('ProfileNoneActive')).toBe('profile.none_active')
    expect(codeForTag('ProfileInvalidName')).toBe('profile.invalid_name')
    expect(codeForTag('ValidationFailed')).toBe('validation.failed')
    expect(codeForTag('ConfigMissingApiUrl')).toBe('config.missing.api_url')
    expect(codeForTag('Generic')).toBe('generic')
  })
})

describe('toErrorEnvelope', () => {
  it('emits the spec §4 envelope shape for WriteRequiresExplicit', () => {
    const err = new WriteRequiresExplicit({
      message: 'writing to production requires explicit acknowledgement',
      hint: 'pass --profile prod to confirm',
      details: { profile: 'prod', api_url: 'https://blog.example.com' },
    })

    const env = toErrorEnvelope(err)

    expect(env).toMatchObject({
      ok: false,
      code: 'profile.write_requires_explicit',
      message: 'writing to production requires explicit acknowledgement',
      hint: 'pass --profile prod to confirm',
      details: { profile: 'prod', api_url: 'https://blog.example.com' },
    })
  })

  it('falls back to the default message when none is provided', () => {
    const env = toErrorEnvelope(new ConfigMissingApiUrl({}))
    expect(env.message).toBe('API URL is not configured')
    expect(env.code).toBe('config.missing.api_url')
  })

  it('omits details when undefined', () => {
    const env = toErrorEnvelope(new Generic({ message: 'something broke' }))
    expect(env).not.toHaveProperty('details')
  })

  it('omits hint when empty string', () => {
    const env = toErrorEnvelope(
      new ValidationFailed({ message: 'bad input', hint: '' }),
    )
    expect(env).not.toHaveProperty('hint')
  })

  it('preserves AuthMissing wire code', () => {
    const env = toErrorEnvelope(new AuthMissing({ message: 'not authed' }))
    expect(env.code).toBe('auth.missing')
  })

  it('preserves NetworkTimeout wire code', () => {
    const env = toErrorEnvelope(new NetworkTimeout({ message: 'slow' }))
    expect(env.code).toBe('network.timeout')
  })

  it('preserves ServerError, ResourceNotFound, ConfigMissingToken codes', () => {
    expect(toErrorEnvelope(new ServerError({})).code).toBe('server.error')
    expect(toErrorEnvelope(new ResourceNotFound({})).code).toBe(
      'resource.not_found',
    )
    expect(toErrorEnvelope(new ConfigMissingToken({})).code).toBe(
      'config.missing.token',
    )
  })

  it('preserves ProfileInvalidName / ProfileNoneActive codes', () => {
    expect(toErrorEnvelope(new ProfileInvalidName({})).code).toBe(
      'profile.invalid_name',
    )
    expect(toErrorEnvelope(new ProfileNoneActive({})).code).toBe(
      'profile.none_active',
    )
  })

  it('preserves update.* sub-codes', () => {
    expect(toErrorEnvelope(new UpdatePmUnknown({})).code).toBe(
      'update.pm_unknown',
    )
    expect(toErrorEnvelope(new UpdatePermissionDenied({})).code).toBe(
      'update.permission_denied',
    )
    expect(toErrorEnvelope(new UpdateRegistryUnreachable({})).code).toBe(
      'update.registry_unreachable',
    )
  })
})
