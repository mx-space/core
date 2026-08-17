import { describe, expect, it } from 'vitest'

import {
  resolvePresenceReaderId,
  toPublicPresenceReader,
} from '~/modules/activity/activity.util'

describe('resolvePresenceReaderId', () => {
  it('prefers the session reader over the socket binding', () => {
    expect(resolvePresenceReaderId('session-1', 'socket-1')).toBe('session-1')
  })

  it('falls back to the socket handshake reader', () => {
    expect(resolvePresenceReaderId(null, 'socket-1')).toBe('socket-1')
  })

  it('ignores a client-supplied reader id', () => {
    expect(resolvePresenceReaderId(null, undefined, 'client-1')).toBeUndefined()
  })
})

describe('toPublicPresenceReader', () => {
  it('keeps only the public card fields', () => {
    expect(
      toPublicPresenceReader({
        id: 133259626412523520n as unknown as string,
        name: 'Magren',
        image: 'https://avatars.githubusercontent.com/u/1?v=4',
        handle: 'magren',
        email: 'hidden@example.com',
        emailVerified: true,
        role: 'reader',
        bannedAt: new Date(),
        membership: { status: 'active' },
      }),
    ).toEqual({
      id: '133259626412523520',
      name: 'Magren',
      image: 'https://avatars.githubusercontent.com/u/1?v=4',
      handle: 'magren',
    })
  })
})
