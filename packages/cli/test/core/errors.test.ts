import { describe, expect, it } from 'vitest'

import { MxsErrorCode as PublicMxsErrorCode } from '../../src'
import { exitCodeForError, MxsError, MxsErrorCode } from '../../src/core/errors'

describe('exitCodeForError', () => {
  it('returns 4 for profile.write_requires_explicit', () => {
    const err = new MxsError({
      code: MxsErrorCode.ProfileWriteRequiresExplicit,
      message: 'write gate refusal',
    })
    expect(exitCodeForError(err)).toBe(4)
  })

  it('returns 4 for profile.none_active', () => {
    const err = new MxsError({
      code: MxsErrorCode.ProfileNoneActive,
      message: 'no active profile',
    })
    expect(exitCodeForError(err)).toBe(4)
  })

  it('returns 5 for profile.invalid_name', () => {
    const err = new MxsError({
      code: MxsErrorCode.ProfileInvalidName,
      message: 'invalid profile name',
    })
    expect(exitCodeForError(err)).toBe(5)
  })

  it('returns 5 for validation.failed', () => {
    const err = new MxsError({ code: MxsErrorCode.ValidationFailed, message: 'bad input' })
    expect(exitCodeForError(err)).toBe(5)
  })

  it('returns 3 for auth.missing', () => {
    const err = new MxsError({ code: MxsErrorCode.AuthMissing, message: 'not authed' })
    expect(exitCodeForError(err)).toBe(3)
  })

  it('returns 1 for generic', () => {
    const err = new MxsError({ code: MxsErrorCode.Generic, message: 'something broke' })
    expect(exitCodeForError(err)).toBe(1)
  })

  it('keeps string literal error codes assignable', () => {
    const err = new MxsError({ code: 'generic', message: 'something broke' })
    expect(err.code).toBe(MxsErrorCode.Generic)
  })

  it('keeps future string error codes assignable', () => {
    const err = new MxsError({ code: 'plugin.custom_failure', message: 'plugin failed' })
    expect(exitCodeForError(err)).toBe(1)
  })

  it('exports runtime error codes from the package root', () => {
    expect(PublicMxsErrorCode.Generic).toBe('generic')
  })

  it('returns 1 for non-MxsError', () => {
    expect(exitCodeForError(new Error('plain'))).toBe(1)
    expect(exitCodeForError('string error')).toBe(1)
  })
})
