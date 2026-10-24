import { firstValueFrom, of } from 'rxjs'
import { describe, expect, it } from 'vitest'

import {
  isExplicitSuccessEnvelope,
  withMeta,
} from '~/common/response/envelope.types'
import { CommentFilterEmailInterceptor } from '~/modules/comment/comment.interceptor'

const comment = () => ({
  id: '1',
  text: 'hello',
  author: 'reader',
  refId: '2',
  refType: 'post',
  state: 0,
  createdAt: new Date(),
  mail: 'private@example.com',
  ip: '127.0.0.1',
  agent: 'private agent',
  location: 'private location',
  meta: 'private metadata',
  reader: {
    id: '3',
    name: 'Reader',
    image: 'avatar',
    email: 'secret@example.com',
    role: 'owner',
    banReason: 'private',
  },
})

const filter = (value: unknown, request = {}) =>
  firstValueFrom(
    new CommentFilterEmailInterceptor().intercept(
      { switchToHttp: () => ({ getRequest: () => request }) } as any,
      { handle: () => of(value) },
    ),
  )

describe('public comment privacy', () => {
  it.each(['detail', 'list', 'thread'])(
    'projects nested %s responses for signed-in readers too',
    async (shape) => {
      const value =
        shape === 'detail'
          ? comment()
          : shape === 'list'
            ? withMeta([{ ...comment(), replies: [comment()] }], {})
            : { replies: [comment()], remaining: 0, done: true }
      const result = await filter(value, {
        user: { role: 'reader' },
        hasAdminAccess: false,
      })
      const serialized = JSON.stringify(result)
      for (const secret of [
        'private@example.com',
        '127.0.0.1',
        'private agent',
        'private location',
        'private metadata',
        'secret@example.com',
        'banReason',
      ]) {
        expect(serialized).not.toContain(secret)
      }
      expect(serialized).toContain('hello')
      if (shape === 'list') expect(isExplicitSuccessEnvelope(result)).toBe(true)
    },
  )
  it('preserves owner moderation fields', async () => {
    expect(await filter(comment(), { hasAdminAccess: true })).toMatchObject({
      ip: '127.0.0.1',
      mail: 'private@example.com',
    })
  })
})
