import { describe, expect, it } from 'vitest'

import {
  detectWireVersion,
  normalizeErrorBody,
  normalizeSuccessBody,
} from '../../src/domain/envelope-compat'

describe('detectWireVersion', () => {
  it('classifies V3 success envelope with meta', () => {
    expect(detectWireVersion({ data: [], meta: {} })).toBe('v3')
  })

  it('classifies V3 error envelope by error.code', () => {
    expect(detectWireVersion({ error: { code: 'POST_NOT_FOUND' } })).toBe('v3')
  })

  it('classifies V3 error envelope by error.message', () => {
    expect(detectWireVersion({ error: { message: 'not found' } })).toBe('v3')
  })

  it('classifies V2 paginated body via root pagination', () => {
    expect(
      detectWireVersion({
        data: [],
        pagination: { page: 1, size: 10, total: 0 },
      }),
    ).toBe('v2')
  })

  it('classifies V2 error by root-level string message', () => {
    expect(detectWireVersion({ message: 'oops' })).toBe('v2')
  })

  it('classifies V2 error by root-level array message', () => {
    expect(detectWireVersion({ message: ['a', 'b'] })).toBe('v2')
  })

  it('returns null for scalar / null / array / non-object', () => {
    expect(detectWireVersion(null)).toBeNull()
    expect(detectWireVersion(42)).toBeNull()
    expect(detectWireVersion('plain text')).toBeNull()
    expect(detectWireVersion([1, 2, 3])).toBeNull()
    expect(detectWireVersion(undefined)).toBeNull()
  })

  it('prefers V3 when both V2 and V3 markers are present', () => {
    expect(
      detectWireVersion({
        data: [],
        pagination: { page: 1 },
        meta: { pagination: { page: 1 } },
      }),
    ).toBe('v3')
  })

  it('returns null for an empty object', () => {
    expect(detectWireVersion({})).toBeNull()
  })
})

describe('normalizeSuccessBody', () => {
  it('passes V3 envelope through unchanged', () => {
    const input = { data: [{ id: '1' }], meta: { pagination: { page: 1 } } }
    expect(normalizeSuccessBody(input)).toBe(input)
  })

  it('lifts V2 root pagination under meta', () => {
    const input = {
      data: [{ id: '1' }],
      pagination: { page: 1, size: 10, total: 5 },
    }
    expect(normalizeSuccessBody(input)).toEqual({
      data: [{ id: '1' }],
      meta: { pagination: { page: 1, size: 10, total: 5 } },
    })
  })

  it('passes a bare V2 { data } envelope through unchanged', () => {
    const input = { data: { id: '1', title: 'hi' } }
    expect(normalizeSuccessBody(input)).toBe(input)
  })

  it('passes a scalar / null / array through unchanged', () => {
    expect(normalizeSuccessBody(42)).toBe(42)
    expect(normalizeSuccessBody(null)).toBe(null)
    const arr = [1, 2, 3]
    expect(normalizeSuccessBody(arr)).toBe(arr)
  })

  it('passes an already-unwrapped document (no data key) through unchanged', () => {
    const input = { id: '1', title: 'already unwrapped' }
    expect(normalizeSuccessBody(input)).toBe(input)
  })

  it('does not mutate the input', () => {
    const input = { data: [], pagination: { page: 1 } }
    const snapshot = JSON.parse(JSON.stringify(input))
    normalizeSuccessBody(input)
    expect(input).toEqual(snapshot)
  })
})

describe('normalizeErrorBody', () => {
  it('unwraps a V3 error envelope', () => {
    expect(
      normalizeErrorBody({
        error: {
          code: 'POST_NOT_FOUND',
          message: 'post not found',
          details: { id: 'p1' },
        },
      }),
    ).toEqual({
      code: 'POST_NOT_FOUND',
      message: 'post not found',
      details: { id: 'p1' },
    })
  })

  it('flattens a V2 string-message error', () => {
    expect(normalizeErrorBody({ message: 'oops', code: 'BAD' })).toEqual({
      code: 'BAD',
      message: 'oops',
      details: undefined,
    })
  })

  it('joins a V2 array-message error with "; "', () => {
    expect(normalizeErrorBody({ message: ['a', 'b'] })).toEqual({
      code: undefined,
      message: 'a; b',
      details: undefined,
    })
  })

  it('returns empty object for non-object body', () => {
    expect(normalizeErrorBody(null)).toEqual({})
    expect(normalizeErrorBody(42)).toEqual({})
    expect(normalizeErrorBody('plain')).toEqual({})
    expect(normalizeErrorBody([1, 2, 3])).toEqual({})
  })

  it('preserves V2 details if present', () => {
    expect(
      normalizeErrorBody({ message: 'x', details: { field: 'y' } }),
    ).toEqual({ code: undefined, message: 'x', details: { field: 'y' } })
  })

  it('ignores non-string V2 message', () => {
    expect(normalizeErrorBody({ message: 42 })).toEqual({
      code: undefined,
      message: undefined,
      details: undefined,
    })
  })

  it('ignores non-string V3 error.code / error.message', () => {
    expect(
      normalizeErrorBody({ error: { code: 42, message: { x: 1 } } }),
    ).toEqual({ code: undefined, message: undefined, details: undefined })
  })
})
