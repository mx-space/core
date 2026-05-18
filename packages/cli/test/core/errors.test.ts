import { describe, expect, it } from 'vitest'

import { exitCodeForError, MxsError } from '../../src/core/errors'

describe('exitCodeForError', () => {
  it('returns 4 for profile.write_requires_explicit', () => {
    const err = new MxsError({
      code: 'profile.write_requires_explicit',
      message: 'write gate refusal',
    })
    expect(exitCodeForError(err)).toBe(4)
  })

  it('returns 4 for profile.none_active', () => {
    const err = new MxsError({
      code: 'profile.none_active',
      message: 'no active profile',
    })
    expect(exitCodeForError(err)).toBe(4)
  })

  it('returns 5 for profile.invalid_name', () => {
    const err = new MxsError({
      code: 'profile.invalid_name',
      message: 'invalid profile name',
    })
    expect(exitCodeForError(err)).toBe(5)
  })

  it('returns 5 for validation.failed', () => {
    const err = new MxsError({ code: 'validation.failed', message: 'bad input' })
    expect(exitCodeForError(err)).toBe(5)
  })

  it('returns 3 for auth.missing', () => {
    const err = new MxsError({ code: 'auth.missing', message: 'not authed' })
    expect(exitCodeForError(err)).toBe(3)
  })

  it('returns 1 for generic', () => {
    const err = new MxsError({ code: 'generic', message: 'something broke' })
    expect(exitCodeForError(err)).toBe(1)
  })

  it('returns 1 for non-MxsError', () => {
    expect(exitCodeForError(new Error('plain'))).toBe(1)
    expect(exitCodeForError('string error')).toBe(1)
  })
})
