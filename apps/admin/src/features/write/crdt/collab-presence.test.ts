import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCollabPresence, PRESENCE_COLORS } from './collab-presence'

const user = (id: string) => ({ avatar: null, id, name: `User ${id}` })

const pair = () => {
  const toB: Uint8Array[] = []
  const toA: Uint8Array[] = []
  const a = createCollabPresence({ send: (bytes) => toB.push(bytes) })
  const b = createCollabPresence({ send: (bytes) => toA.push(bytes) })
  const deliver = () => {
    for (const bytes of toB.splice(0)) b.apply(bytes)
    for (const bytes of toA.splice(0)) a.apply(bytes)
  }
  return { a, b, deliver }
}

describe('createCollabPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shares carets between members, never listing itself', () => {
    const { a, b, deliver } = pair()
    const seen = vi.fn()
    b.subscribe(seen)
    a.start('conn-a', user('owner'))
    b.start('conn-b', user('owner'))

    vi.advanceTimersByTime(1)
    a.setCursor({ id: '1@2', offset: 3 }, { id: '1@2', offset: 5 })
    deliver()

    expect(b.remotes()).toEqual([
      {
        anchor: { id: '1@2', offset: 3 },
        color: expect.any(String),
        focus: { id: '1@2', offset: 5 },
        key: 'conn-a',
        user: user('owner'),
      },
    ])
    expect(a.remotes().map((remote) => remote.key)).toEqual(['conn-b'])
    expect(seen).toHaveBeenLastCalledWith(b.remotes())
  })

  it('answers a newcomer with its full state', () => {
    const { a, b, deliver } = pair()
    a.start('conn-a', user('owner'))
    vi.advanceTimersByTime(1)
    a.setCursor(null, { id: '1@2', offset: 1 })
    deliver()
    b.start('conn-b', user('owner'))

    vi.advanceTimersByTime(1)
    a.announce()
    deliver()

    expect(b.remotes().map((remote) => remote.focus)).toEqual([
      { id: '1@2', offset: 1 },
    ])
  })

  it('drops a member that left or went quiet', () => {
    const { a, b, deliver } = pair()
    a.start('conn-a', user('owner'))
    b.start('conn-b', user('owner'))
    deliver()
    expect(b.remotes()).toHaveLength(1)

    b.remove('conn-a')
    expect(b.remotes()).toHaveLength(0)
  })

  it('expires a member that went quiet', async () => {
    vi.useRealTimers()
    const watcher = createCollabPresence({
      refreshMs: 60_000,
      send: () => undefined,
      timeoutMs: 100,
    })
    watcher.start('conn-b', user('owner'))
    watcher.apply(
      (() => {
        let captured: Uint8Array = new Uint8Array()
        const probe = createCollabPresence({
          refreshMs: 60_000,
          send: (bytes) => {
            captured = bytes
          },
          timeoutMs: 100,
        })
        probe.start('conn-a', user('owner'))
        probe.dispose()
        return captured
      })(),
    )
    expect(watcher.remotes()).toHaveLength(1)

    await vi.waitFor(() => expect(watcher.remotes()).toHaveLength(0), {
      timeout: 2000,
    })
    watcher.dispose()
  })

  it('refreshes its own state so it does not expire for others', () => {
    const sent: Uint8Array[] = []
    const a = createCollabPresence({ send: (bytes) => sent.push(bytes) })
    a.start('conn-a', user('owner'))
    const initial = sent.length

    vi.advanceTimersByTime(25_000)

    expect(sent.length).toBeGreaterThan(initial)
    a.dispose()
    const afterDispose = sent.length
    vi.advanceTimersByTime(25_000)
    expect(sent.length).toBe(afterDispose)
  })

  it('picks a stable color per member', () => {
    const { a, b, deliver } = pair()
    a.start('conn-a', user('owner'))
    b.start('conn-b', user('owner'))
    deliver()

    const color = b.remotes()[0].color
    vi.advanceTimersByTime(1)
    a.setCursor(null, { id: '1@2', offset: 9 })
    deliver()

    expect(PRESENCE_COLORS).toContain(color)
    expect(b.remotes()[0].color).toBe(color)
  })

  it('stays quiet about its own caret and skips unchanged carets', () => {
    const sent: Uint8Array[] = []
    const a = createCollabPresence({ send: (bytes) => sent.push(bytes) })
    const seen = vi.fn()
    a.subscribe(seen)
    a.start('conn-a', user('owner'))
    const afterStart = sent.length

    vi.advanceTimersByTime(1)
    a.setCursor(null, { id: '1@2', offset: 1 })
    vi.advanceTimersByTime(1)
    a.setCursor(null, { id: '1@2', offset: 1 })

    expect(seen).not.toHaveBeenCalled()
    expect(sent.length).toBe(afterStart + 1)
    a.dispose()
  })

  it('publishes an extra member such as the agent and removes it again', () => {
    const { a, b, deliver } = pair()
    a.start('conn-a', user('owner'))
    b.start('conn-b', user('owner'))
    deliver()

    vi.advanceTimersByTime(1)
    a.setExtra('agent:run-1', {
      anchor: null,
      color: '#8e4ec6',
      focus: { id: '3@4', offset: 2 },
      user: { avatar: null, id: 'agent', name: 'AI' },
    })
    deliver()

    expect(b.remotes().map((remote) => remote.key)).toEqual([
      'agent:run-1',
      'conn-a',
    ])
    expect(a.remotes().map((remote) => remote.key)).toEqual([
      'agent:run-1',
      'conn-b',
    ])

    vi.advanceTimersByTime(1)
    a.setExtra('agent:run-1', null)
    deliver()

    expect(b.remotes().map((remote) => remote.key)).toEqual(['conn-a'])
    expect(a.remotes().map((remote) => remote.key)).toEqual(['conn-b'])
  })
})
