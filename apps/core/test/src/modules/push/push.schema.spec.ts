import { describe, expect, it } from 'vitest'

import * as pushSchema from '~/modules/push/push.schema'
import {
  PushActivationRequestSchema,
  PushActivationResponseSchema,
} from '~/modules/push/push.schema'

const ticket = 't'.repeat(32)

describe('PushActivationRequestSchema', () => {
  it('accepts an https relay origin with a device activation ticket', () => {
    expect(
      PushActivationRequestSchema.parse({
        relayUrl: 'https://push.example.com',
        activationTicket: ticket,
      }),
    ).toEqual({
      relayUrl: 'https://push.example.com',
      activationTicket: ticket,
    })
  })

  it('accepts a loopback relay origin for local development', () => {
    expect(
      PushActivationRequestSchema.safeParse({
        relayUrl: 'http://localhost:8787',
        activationTicket: ticket,
      }).success,
    ).toBe(true)
  })

  it('rejects plain http, non-origin URLs, short tickets, and extra keys', () => {
    expect(
      PushActivationRequestSchema.safeParse({
        relayUrl: 'http://push.example.com',
        activationTicket: ticket,
      }).success,
    ).toBe(false)
    expect(
      PushActivationRequestSchema.safeParse({
        relayUrl: 'https://push.example.com/v1',
        activationTicket: ticket,
      }).success,
    ).toBe(false)
    expect(
      PushActivationRequestSchema.safeParse({
        relayUrl: 'https://push.example.com',
        activationTicket: 'short',
      }).success,
    ).toBe(false)
    expect(
      PushActivationRequestSchema.safeParse({
        relayUrl: 'https://push.example.com',
        activationTicket: ticket,
        readerId: 'reader-1',
      }).success,
    ).toBe(false)
  })

  it('describes the response with the relay binding id the device must store', () => {
    expect(
      PushActivationResponseSchema.parse({
        enabled: true,
        relayUrl: 'https://push.example.com',
        bindingId: 'bnd_remote',
      }),
    ).toMatchObject({ bindingId: 'bnd_remote' })
  })
})

describe('push schema surface', () => {
  it('no longer exports reader-scoped preference or status contracts', () => {
    expect(Object.keys(pushSchema).sort()).toEqual([
      'PushActivationRequestDto',
      'PushActivationRequestSchema',
      'PushActivationResponseSchema',
    ])
  })
})
