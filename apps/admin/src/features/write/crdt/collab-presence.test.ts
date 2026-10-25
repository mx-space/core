import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AGENT_PRESENCE_COLOR,
  createCollabPresence,
  type OutgoingPresence,
  PRESENCE_COLORS,
} from './collab-presence'

const user = (id: string) => ({ avatar: null, id, name: `User ${id}` })

const member = (connectionId: string, id: string) => {
  const outbox: OutgoingPresence[] = []
  const presence = createCollabPresence({
    send: (frame) => outbox.push(frame),
  })
  const stamp = (frame: OutgoingPresence) => ({
    caret: frame.caret,
    connectionId,
    documentId: 'doc-1',
    entry: frame.entry ?? null,
    user: frame.entry
      ? { avatar: null, id: frame.entry, name: 'AI' }
      : user(id),
  })
  return { connectionId, outbox, presence, stamp }
}

const pair = () => {
  const a = member('conn-a', 'owner')
  const b = member('conn-b', 'r1')
  const deliver = () => {
    for (const frame of a.outbox.splice(0)) b.presence.apply(a.stamp(frame))
    for (const frame of b.outbox.splice(0)) a.presence.apply(b.stamp(frame))
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

  it('shows other members with the identity the server stamped', () => {
    const { a, b, deliver } = pair()
    const seen = vi.fn()
    b.presence.subscribe(seen)
    a.presence.start()
    b.presence.start()

    a.presence.setCursor({ id: '1@2', offset: 3 }, { id: '1@2', offset: 5 })
    deliver()

    expect(b.presence.remotes()).toEqual([
      {
        anchor: { id: '1@2', offset: 3 },
        color: expect.any(String),
        focus: { id: '1@2', offset: 5 },
        key: 'conn-a',
        user: user('owner'),
      },
    ])
    expect(a.presence.remotes()).toEqual([
      expect.objectContaining({ key: 'conn-b', user: user('r1') }),
    ])
    expect(seen).toHaveBeenCalled()
  })

  it('answers a newcomer with its caret and extras', () => {
    const { a } = pair()
    a.presence.start()
    a.presence.setCursor({ id: '1@2', offset: 1 }, null)
    a.presence.setExtra('agent:7', { anchor: null, focus: null })
    a.outbox.length = 0

    a.presence.announce()

    expect(a.outbox).toEqual([
      { caret: { anchor: { id: '1@2', offset: 1 }, focus: null } },
      { caret: { anchor: null, focus: null }, entry: 'agent:7' },
    ])
  })

  it('drops every entry of a connection that left', () => {
    const { a, b, deliver } = pair()
    a.presence.start()
    a.presence.setExtra('agent:7', { anchor: null, focus: null })
    deliver()
    expect(b.presence.remotes()).toHaveLength(2)

    b.presence.removeConnection('conn-a')

    expect(b.presence.remotes()).toEqual([])
  })

  it('expires members it has not heard from and keeps its own state fresh', () => {
    const { a, b, deliver } = pair()
    a.presence.start()
    b.presence.start()
    deliver()
    expect(b.presence.remotes()).toHaveLength(1)

    vi.advanceTimersByTime(10_000)
    deliver()
    vi.advanceTimersByTime(25_000)
    expect(b.presence.remotes()).toHaveLength(1)

    a.presence.dispose()
    vi.advanceTimersByTime(31_000)
    expect(b.presence.remotes()).toEqual([])
  })

  it('removes an entry the sender cleared', () => {
    const { a, b, deliver } = pair()
    a.presence.start()
    a.presence.setExtra('agent:7', {
      anchor: null,
      focus: { id: '3@4', offset: 0 },
    })
    deliver()
    expect(b.presence.remotes().map((peer) => peer.key)).toEqual([
      'conn-a',
      'conn-a/agent:7',
    ])

    a.presence.setExtra('agent:7', null)
    deliver()

    expect(b.presence.remotes().map((peer) => peer.key)).toEqual(['conn-a'])
  })

  it('lists its own agent entry locally, since the server never echoes it', () => {
    const { a } = pair()
    a.presence.start()

    a.presence.setExtra('agent:7', { anchor: null, focus: null })

    expect(a.presence.remotes()).toEqual([
      expect.objectContaining({
        color: AGENT_PRESENCE_COLOR,
        key: 'local/agent:7',
        user: expect.objectContaining({ name: 'AI' }),
      }),
    ])
  })

  it('picks a stable color per member and the agent color for agent entries', () => {
    const { a, b, deliver } = pair()
    a.presence.start()
    a.presence.setExtra('agent:7', { anchor: null, focus: null })
    deliver()

    const [human, agent] = b.presence.remotes()
    expect(PRESENCE_COLORS).toContain(human.color)
    expect(agent.color).toBe(AGENT_PRESENCE_COLOR)
  })

  it('skips sending a caret that did not move', () => {
    const { a } = pair()
    a.presence.start()
    a.outbox.length = 0

    a.presence.setCursor({ id: '1@2', offset: 1 }, null)
    a.presence.setCursor({ id: '1@2', offset: 1 }, null)

    expect(a.outbox).toHaveLength(1)
  })

  it('stays silent before it has joined a room', () => {
    const { a } = pair()

    a.presence.setCursor({ id: '1@2', offset: 1 }, null)

    expect(a.outbox).toEqual([])
  })

  it('gives everyone on screen a different color while the palette lasts', () => {
    const presence = createCollabPresence({ send: () => undefined })
    for (const connectionId of ['conn-0', 'conn-8']) {
      presence.apply({
        caret: { anchor: null, focus: null },
        connectionId,
        entry: null,
        user: user(connectionId),
      })
    }

    const [first, second] = presence.remotes()
    expect(first.color).not.toBe(second.color)
  })
})
