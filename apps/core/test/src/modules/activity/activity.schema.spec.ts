import { describe, expect, it } from 'vitest'

import { UpdatePresenceSchema } from '~/modules/activity/activity.schema'

const base = {
  identity: 'abcd1234',
  roomName: 'article-1',
  ts: 1,
  position: 10,
  sid: 'abcd1234',
}

describe('UpdatePresenceSchema image', () => {
  it('accepts an https avatar url', () => {
    const parsed = UpdatePresenceSchema.parse({
      ...base,
      image: 'https://avatars.githubusercontent.com/u/1?v=4',
    })
    expect(parsed.image).toBe('https://avatars.githubusercontent.com/u/1?v=4')
  })

  it('rejects http and non-url images', () => {
    expect(() =>
      UpdatePresenceSchema.parse({
        ...base,
        image: 'http://example.com/a.png',
      }),
    ).toThrow()
    expect(() =>
      UpdatePresenceSchema.parse({
        ...base,
        image: 'data:image/png;base64,abc',
      }),
    ).toThrow()
  })
})
