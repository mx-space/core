import { describe, expect, it } from 'vitest'

import {
  ACK_EVENT,
  PING_EVENT,
  WS_PROTOCOL_VERSION,
  buildEnvelope,
  isWsEnvelope,
} from '../src/protocol.js'

describe('protocol constants', () => {
  it('exposes the reserved event names', () => {
    expect(WS_PROTOCOL_VERSION).toBe(1)
    expect(ACK_EVENT).toBe('ack')
    expect(PING_EVENT).toBe('ping')
  })
})

describe('buildEnvelope', () => {
  it('omits payload and id when absent', () => {
    expect(buildEnvelope('greet')).toEqual({ v: 1, event: 'greet' })
  })

  it('includes payload when provided, even falsy values', () => {
    expect(buildEnvelope('greet', 0)).toEqual({
      v: 1,
      event: 'greet',
      payload: 0,
    })
    expect(buildEnvelope('greet', null)).toEqual({
      v: 1,
      event: 'greet',
      payload: null,
    })
  })

  it('includes id when provided', () => {
    expect(buildEnvelope('greet', { hi: true }, 'req-1')).toEqual({
      v: 1,
      event: 'greet',
      payload: { hi: true },
      id: 'req-1',
    })
  })
})

describe('isWsEnvelope', () => {
  it('accepts a minimal valid envelope', () => {
    expect(isWsEnvelope({ v: 1, event: 'ping' })).toBe(true)
  })

  it('accepts an envelope with payload and id', () => {
    expect(
      isWsEnvelope({ v: 1, event: 'ping', payload: { a: 1 }, id: 'x' }),
    ).toBe(true)
  })

  it('rejects non-object values', () => {
    expect(isWsEnvelope(null)).toBe(false)
    expect(isWsEnvelope(undefined)).toBe(false)
    expect(isWsEnvelope('string')).toBe(false)
    expect(isWsEnvelope(42)).toBe(false)
    expect(isWsEnvelope([])).toBe(false)
  })

  it('rejects a non-numeric v', () => {
    expect(isWsEnvelope({ v: '1', event: 'ping' })).toBe(false)
  })

  it('rejects an unsupported protocol version', () => {
    expect(isWsEnvelope({ v: 2, event: 'ping' })).toBe(false)
    expect(isWsEnvelope({ v: 0, event: 'ping' })).toBe(false)
  })

  it('rejects a missing or empty event', () => {
    expect(isWsEnvelope({ v: 1 })).toBe(false)
    expect(isWsEnvelope({ v: 1, event: '' })).toBe(false)
    expect(isWsEnvelope({ v: 1, event: 42 })).toBe(false)
  })

  it('rejects a non-string id', () => {
    expect(isWsEnvelope({ v: 1, event: 'ping', id: 42 })).toBe(false)
  })
})
