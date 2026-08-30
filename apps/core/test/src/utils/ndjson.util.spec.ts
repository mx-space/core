import { Observable } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { subscribeNdjson } from '~/utils/ndjson.util'

function fakeReply() {
  const chunks: string[] = []
  const listeners = new Map<string, () => void>()
  const raw = {
    ended: false,
    writableEnded: false,
    write(chunk: string) {
      chunks.push(chunk)
      return true
    },
    end() {
      this.ended = true
      this.writableEnded = true
    },
    once(event: string, handler: () => void) {
      listeners.set(event, handler)
    },
  }
  return {
    chunks,
    close() {
      listeners.get('close')?.()
    },
    reply: { raw } as any,
  }
}

describe('subscribeNdjson', () => {
  it('writes one JSON object per line', async () => {
    const { chunks, reply } = fakeReply()
    await subscribeNdjson(
      reply,
      new Observable((subscriber) => {
        subscriber.next({ id: '1', kind: 'post' })
        subscriber.next({ id: '2', missing: true })
        subscriber.complete()
      }),
    )
    expect(chunks).toEqual([
      '{"id":"1","kind":"post"}\n',
      '{"id":"2","missing":true}\n',
    ])
    expect(reply.raw.writableEnded).toBe(true)
  })

  it('unsubscribes when the client disconnects', async () => {
    const { close, reply } = fakeReply()
    let cleaned = false
    const pending = subscribeNdjson(
      reply,
      new Observable((subscriber) => {
        subscriber.next({ id: '1' })
        return () => {
          cleaned = true
        }
      }),
    )
    close()
    expect(cleaned).toBe(true)
    reply.raw.end()
    await pending.catch(() => {})
  })
})
