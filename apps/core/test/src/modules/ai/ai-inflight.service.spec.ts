import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '~/modules/ai/ai-inflight/ai-inflight.types'
import { RedisService } from '~/processors/redis/redis.service'
import { sendSseEvent } from '~/utils/sse.util'

interface XAddCall {
  key: string
  fields: string[]
}

class FakeRedis {
  store = new Map<string, string>()
  streams = new Map<string, Array<[string, string[]]>>()
  xaddCalls: XAddCall[] = []
  delCalls: string[] = []
  callLog: string[] = []
  private streamSeq = 0

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string, ...args: any[]) {
    this.callLog.push(`set:${key}`)
    const hasNx = args.includes('NX')
    if (hasNx && this.store.has(key)) {
      return null
    }
    this.store.set(key, value)
    return 'OK'
  }

  async exists(key: string) {
    return this.store.has(key) ? 1 : 0
  }

  async expire(_key: string, _seconds: number) {
    return 1
  }

  async del(key: string) {
    this.callLog.push(`del:${key}`)
    this.delCalls.push(key)
    this.store.delete(key)
    // real Redis DEL removes the key regardless of its underlying type —
    // a stream key must lose its entries too, or a follower re-reading
    // from '0-0' would still see them.
    this.streams.delete(key)
    return 1
  }

  async xadd(key: string, ...args: string[]) {
    const starIndex = args.lastIndexOf('*')
    const fields = args.slice(starIndex + 1)
    this.xaddCalls.push({ key, fields })
    const id = `${++this.streamSeq}-0`
    const entries = this.streams.get(key) || []
    entries.push([id, fields])
    this.streams.set(key, entries)
    return id
  }

  async xread(
    _block: string,
    _ms: number,
    _streams: string,
    key: string,
    lastId: string,
  ) {
    const entries = this.streams.get(key) || []
    const startIndex =
      lastId === '0-0'
        ? 0
        : entries.findIndex((entry) => entry[0] === lastId) + 1

    const nextEntries = entries.slice(Math.max(0, startIndex))
    if (!nextEntries.length) {
      return null
    }

    return [[key, nextEntries]]
  }
}

interface FauxReply {
  raw: {
    writes: string[]
    write: (chunk: string) => void
    on: (_evt: string, _cb: () => void) => void
    setHeader: (_k: string, _v: string) => void
    flushHeaders: () => void
    end: () => void
  }
}

function createFauxReply(): FauxReply {
  const writes: string[] = []
  return {
    raw: {
      writes,
      write(chunk: string) {
        writes.push(chunk)
      },
      on() {},
      setHeader() {},
      flushHeaders() {},
      end() {},
    },
  }
}

async function pipeEventsToReply(
  events: AsyncIterable<AiStreamEvent>,
  reply: FauxReply,
  hydrate: (resultId: string) => unknown,
) {
  let sentToken = false
  for await (const event of events) {
    if (event.type === 'token') {
      sendSseEvent(reply as any, 'token', event.data)
      sentToken = true
    } else if (event.type === 'done') {
      if (!sentToken) {
        const doc = hydrate(event.data.resultId)
        sendSseEvent(reply as any, 'token', doc)
      }
      sendSseEvent(reply as any, 'done', undefined)
      break
    } else {
      sendSseEvent(reply as any, 'error', event.data)
      break
    }
  }
}

async function buildService() {
  const fakeRedis = new FakeRedis()
  const module = await Test.createTestingModule({
    providers: [
      AiInFlightService,
      { provide: RedisService, useValue: { getClient: () => fakeRedis } },
    ],
  }).compile()
  const service = module.get(AiInFlightService)
  return { service, fakeRedis }
}

describe('AiInFlightService — public SSE envelope', () => {
  it('STREAMING: 10-chunk faux stream produces 10 token frames in exact order then done', async () => {
    const { service } = await buildService()
    const reply = createFauxReply()

    const chunks = Array.from({ length: 10 }, (_, i) => `c${i}`)

    const { events, result } = await service.runWithStream<{ id: string }>({
      key: 'streaming:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async ({ push }) => {
        for (const chunk of chunks) {
          await push({ type: 'token', data: chunk })
        }
        return { result: { id: 'r-stream' }, resultId: 'r-stream' }
      },
      parseResult: async (id: string) => ({ id }),
    })

    await pipeEventsToReply(events, reply, () => ({ id: 'unused' }))
    await expect(result).resolves.toEqual({ id: 'r-stream' })

    const expected: string[] = []
    for (const c of chunks) {
      expected.push('event: token\n', `data: ${c}\n\n`)
    }
    expected.push('event: done\n\n')

    expect(reply.raw.writes).toEqual(expected)
  })

  it('CACHED-HYDRATE: bytes match pre-migration snapshot exactly', async () => {
    const { service, fakeRedis } = await buildService()
    const reply = createFauxReply()

    const cachedModel = {
      id: 'r-cache-1',
      articleId: 'a1',
      lang: 'en',
      summary: 'hello world',
      createdAt: '2026-05-30T00:00:00.000Z',
    }

    // simulate a prior leader completion: result key is set, so this run is a cached-hydrate follower
    await fakeRedis.set('ai:stream:cache:1:result', cachedModel.id)

    const { events, result } = await service.runWithStream<typeof cachedModel>({
      key: 'cache:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async () => {
        throw new Error('leader should not run on cache hit')
      },
      parseResult: async () => cachedModel,
    })

    await pipeEventsToReply(events, reply, () => cachedModel)
    await expect(result).resolves.toEqual(cachedModel)

    const actualBytes = reply.raw.writes.join('')
    const fixturePath = join(
      __dirname,
      '../../../fixtures/sse-cached-hydrate/summary.bytes',
    )
    const expectedBytes = readFileSync(fixturePath, 'utf8')

    expect(actualBytes).toBe(expectedBytes)
  })

  it('ERROR: yields error frame "event: error\\ndata: {message}\\n\\n"', async () => {
    const { service } = await buildService()
    const reply = createFauxReply()

    const { events, result } = await service.runWithStream<{ id: string }>({
      key: 'errflow:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async () => {
        throw new Error('boom')
      },
      parseResult: async (id: string) => ({ id }),
    })

    // swallow the leader rejection so test framework does not flag unhandled
    result.catch(() => undefined)

    // wait for leader to settle so error event is xadded before the reader loops
    await result.catch(() => undefined)

    await pipeEventsToReply(events, reply, () => ({ id: 'unused' }))

    expect(reply.raw.writes).toEqual([
      'event: error\n',
      'data: {"message":"boom"}\n\n',
    ])
  })

  it('LEADER/FOLLOWER PARITY: same faux input produces byte-identical reply.raw.write sequences', async () => {
    const chunks = ['alpha', 'beta', 'gamma']

    // LEADER PATH — first run acquires the lock and pushes events.
    const leader = await buildService()
    const leaderReply = createFauxReply()
    const leaderRun = await leader.service.runWithStream<{ id: string }>({
      key: 'parity:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async ({ push }) => {
        for (const c of chunks) {
          await push({ type: 'token', data: c })
        }
        return { result: { id: 'r-parity' }, resultId: 'r-parity' }
      },
      parseResult: async (id: string) => ({ id }),
    })
    await pipeEventsToReply(leaderRun.events, leaderReply, () => ({
      id: 'unused',
    }))
    await expect(leaderRun.result).resolves.toEqual({ id: 'r-parity' })

    // FOLLOWER PATH — pre-populate Redis with the same XADD field shape the leader produced,
    // then drive a second service through xread.
    const follower = await buildService()
    const followerReply = createFauxReply()
    const streamKey = 'ai:stream:parity:1:stream'
    const lockKey = 'ai:stream:parity:1:lock'
    await follower.fakeRedis.set(lockKey, 'leader-token') // ensure follower path
    for (const c of chunks) {
      await follower.fakeRedis.xadd(
        streamKey,
        'MAXLEN',
        '~',
        '100',
        '*',
        'type',
        'token',
        'data',
        JSON.stringify(c),
      )
    }
    await follower.fakeRedis.xadd(
      streamKey,
      'MAXLEN',
      '~',
      '100',
      '*',
      'type',
      'done',
      'data',
      JSON.stringify({ resultId: 'r-parity' }),
    )
    // result key intentionally NOT pre-set: forces stream replay through xread,
    // exercising the same code path the follower hits in production
    // before the leader writes resultKey at stream-end.

    const followerRun = await follower.service.runWithStream<{ id: string }>({
      key: 'parity:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async () => ({ result: { id: 'unused' }, resultId: 'unused' }),
      parseResult: async (id: string) => ({ id }),
    })
    await pipeEventsToReply(followerRun.events, followerReply, () => ({
      id: 'unused',
    }))
    // simulate the leader publishing the final resultKey so waitForResult resolves
    await follower.fakeRedis.set('ai:stream:parity:1:result', 'r-parity')
    await expect(followerRun.result).resolves.toEqual({ id: 'r-parity' })

    expect(followerReply.raw.writes).toEqual(leaderReply.raw.writes)
  })

  it('Redis XADD field shape: [type, <name>, data, JSON.stringify(<payload>)]', async () => {
    const { service, fakeRedis } = await buildService()
    const reply = createFauxReply()

    const { events, result } = await service.runWithStream<{ id: string }>({
      key: 'xadd-shape:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async ({ push }) => {
        await push({ type: 'token', data: 'hello' })
        return { result: { id: 'r-shape' }, resultId: 'r-shape' }
      },
      parseResult: async (id: string) => ({ id }),
    })

    await pipeEventsToReply(events, reply, () => ({ id: 'unused' }))
    await expect(result).resolves.toEqual({ id: 'r-shape' })

    expect(fakeRedis.xaddCalls.length).toBeGreaterThanOrEqual(2)
    expect(fakeRedis.xaddCalls[0].fields).toEqual([
      'type',
      'token',
      'data',
      '"hello"',
    ])
    expect(fakeRedis.xaddCalls[1].fields).toEqual([
      'type',
      'done',
      'data',
      JSON.stringify({ resultId: 'r-shape' }),
    ])
  })

  it('legacy: runs leader flow and yields token + done events', async () => {
    const { service } = await buildService()
    const { events, result } = await service.runWithStream({
      key: 'summary:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async ({ push }) => {
        await push({ type: 'token', data: '{"summary":"hi"}' })
        return { result: { id: 'r1' }, resultId: 'r1' }
      },
      parseResult: async (id: string) => ({ id }),
    })

    const collected: string[] = []
    for await (const event of events) {
      collected.push(event.type)
    }

    await expect(result).resolves.toEqual({ id: 'r1' })
    expect(collected).toEqual(['token', 'done'])
  })

  it('legacy: runs follower flow and replays stream', async () => {
    const { service, fakeRedis } = await buildService()
    await fakeRedis.set('ai:stream:test:lock', 'locked')
    await fakeRedis.xadd(
      'ai:stream:test:stream',
      'MAXLEN',
      '~',
      '100',
      '*',
      'type',
      'token',
      'data',
      '"hello"',
    )
    await fakeRedis.xadd(
      'ai:stream:test:stream',
      'MAXLEN',
      '~',
      '100',
      '*',
      'type',
      'done',
      'data',
      '{"resultId":"r2"}',
    )

    const { events, result } = await service.runWithStream({
      key: 'test',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async () => ({ result: { id: 'x' }, resultId: 'x' }),
      parseResult: async (id: string) => ({ id }),
    })

    await fakeRedis.set('ai:stream:test:result', 'r2')

    const collected: string[] = []
    for await (const event of events) {
      collected.push(event.type)
    }

    await expect(result).resolves.toEqual({ id: 'r2' })
    expect(collected).toEqual(['token', 'done'])
  })

  it('legacy: fails fast when lock missing and no result', async () => {
    const { service, fakeRedis } = await buildService()
    await fakeRedis.set('ai:stream:missing:lock', 'some-leader')

    const { events, result } = await service.runWithStream({
      key: 'missing',
      lockTtlSec: 1,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 50,
      onLeader: async () => ({ result: { id: 'x' }, resultId: 'x' }),
      parseResult: async (id: string) => ({ id }),
    })

    await fakeRedis.del('ai:stream:missing:lock')
    result.catch(() => {})

    let caught: unknown = null
    try {
      for await (const _ of events) {
        // no-op
      }
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AppException)
  })

  it('bypassResultCache: true skips a cached resultKey and deletes it', async () => {
    const { service, fakeRedis } = await buildService()
    const resultKey = 'ai:stream:bypass:1:result'
    await fakeRedis.set(resultKey, 'stale-result')

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'bypass:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      bypassResultCache: true,
      onLeader: async () => ({
        result: { id: 'fresh-result' },
        resultId: 'fresh-result',
      }),
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('leader')
    expect(fakeRedis.delCalls).toContain(resultKey)
    await expect(result).resolves.toEqual({ id: 'fresh-result' })
  })

  it('bypassResultCache: false (default) still reuses a cached resultKey', async () => {
    const { service, fakeRedis } = await buildService()
    const resultKey = 'ai:stream:no-bypass:1:result'
    await fakeRedis.set(resultKey, 'cached-result')

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'no-bypass:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      onLeader: async () => {
        throw new Error('leader should not run on cache hit')
      },
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('follower')
    expect(fakeRedis.delCalls).not.toContain(resultKey)
    await expect(result).resolves.toEqual({ id: 'cached-result' })
  })

  it('bypassResultCache: true — deletes resultKey only after acquiring the lock', async () => {
    const { service, fakeRedis } = await buildService()
    const resultKey = 'ai:stream:bypass-order:1:result'
    const lockKey = 'ai:stream:bypass-order:1:lock'
    await fakeRedis.set(resultKey, 'stale-result')

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'bypass-order:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      bypassResultCache: true,
      onLeader: async () => ({
        result: { id: 'fresh-result' },
        resultId: 'fresh-result',
      }),
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('leader')
    const lockIndex = fakeRedis.callLog.indexOf(`set:${lockKey}`)
    const delIndex = fakeRedis.callLog.indexOf(`del:${resultKey}`)
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(delIndex).toBeGreaterThan(lockIndex)
    await expect(result).resolves.toEqual({ id: 'fresh-result' })
  })

  it('bypassResultCache: true — does not delete resultKey when this request loses the leader race', async () => {
    const { service, fakeRedis } = await buildService()
    const resultKey = 'ai:stream:bypass-follower:1:result'
    const lockKey = 'ai:stream:bypass-follower:1:lock'
    // another force leader already holds the lock and has an in-flight
    // (not-yet-stale) result — joining it as a follower is immediate.
    await fakeRedis.set(lockKey, 'force:other-leader')
    await fakeRedis.set(resultKey, 'in-flight-by-other-leader')

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'bypass-follower:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 200,
      bypassResultCache: true,
      onLeader: async () => {
        throw new Error('should not run: lock already held by another leader')
      },
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('follower')
    expect(fakeRedis.delCalls).not.toContain(resultKey)
    await expect(result).resolves.toEqual({ id: 'in-flight-by-other-leader' })
  })
})

describe('AiInFlightService — force vs plain lock arbitration', () => {
  it('force losing to a plain leader waits, then leads once the plain leader releases the lock, deleting resultKey', async () => {
    const { service, fakeRedis } = await buildService()
    const lockKey = 'ai:stream:wait-plain:1:lock'
    const resultKey = 'ai:stream:wait-plain:1:result'
    await fakeRedis.set(lockKey, 'plain:existing-leader')
    await fakeRedis.set(resultKey, 'stale-result')

    setTimeout(() => {
      fakeRedis.del(lockKey)
    }, 250)

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'wait-plain:1',
      lockTtlSec: 2,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async () => ({ result: { id: 'fresh' }, resultId: 'fresh' }),
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('leader')
    expect(fakeRedis.delCalls).toContain(resultKey)
    await expect(result).resolves.toEqual({ id: 'fresh' })
  })

  it('force waiting on a plain leader joins as a follower if another force takes over the lock mid-wait', async () => {
    const { service, fakeRedis } = await buildService()
    const lockKey = 'ai:stream:wait-plain-then-force:1:lock'
    const resultKey = 'ai:stream:wait-plain-then-force:1:result'
    await fakeRedis.set(lockKey, 'plain:existing-leader')

    // the plain leader releases, and a different force request races in
    // and wins the lock via the ordinary leader path before our next retry
    setTimeout(() => {
      fakeRedis.set(lockKey, 'force:another-leader')
      fakeRedis.set(resultKey, 'joined-other-force-result')
    }, 250)

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'wait-plain-then-force:1',
      lockTtlSec: 2,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async () => {
        throw new Error('should not run: another force took the lock')
      },
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('follower')
    expect(fakeRedis.delCalls).not.toContain(resultKey)
    await expect(result).resolves.toEqual({ id: 'joined-other-force-result' })
  })

  it('force losing to another force joins immediately as a follower, without polling or deleting resultKey', async () => {
    const { service, fakeRedis } = await buildService()
    const lockKey = 'ai:stream:wait-force:1:lock'
    const resultKey = 'ai:stream:wait-force:1:result'
    await fakeRedis.set(lockKey, 'force:other-leader')
    await fakeRedis.set(resultKey, 'in-flight-by-other-force')
    const callLogAtStart = fakeRedis.callLog.length

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'wait-force:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async () => {
        throw new Error('should not run: another force already leads')
      },
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('follower')
    // a single NX attempt on lockKey — no retry polling for a force-held lock
    expect(
      fakeRedis.callLog
        .slice(callLogAtStart)
        .filter((entry) => entry === `set:${lockKey}`),
    ).toHaveLength(1)
    expect(fakeRedis.delCalls).not.toContain(resultKey)
    await expect(result).resolves.toEqual({ id: 'in-flight-by-other-force' })
  })

  it('a plain request losing the lock race is still an immediate follower (behavior unchanged)', async () => {
    const { service, fakeRedis } = await buildService()
    const lockKey = 'ai:stream:plain-loses:1:lock'
    await fakeRedis.set(lockKey, 'plain:other-leader')
    const callLogAtStart = fakeRedis.callLog.length

    const { role } = await service.runWithStream<{ id: string }>({
      key: 'plain-loses:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      onLeader: async () => {
        throw new Error('should not run: lock already held')
      },
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('follower')
    // no bypassResultCache — no retry branch is entered at all
    expect(
      fakeRedis.callLog
        .slice(callLogAtStart)
        .filter((entry) => entry === `set:${lockKey}`),
    ).toHaveLength(1)
  })

  it('force gives up waiting after lockTtlSec and degrades to a follower without throwing', async () => {
    const { service, fakeRedis } = await buildService()
    const lockKey = 'ai:stream:wait-timeout:1:lock'
    const resultKey = 'ai:stream:wait-timeout:1:result'
    await fakeRedis.set(lockKey, 'plain:stuck-leader')

    const { role, result } = await service.runWithStream<{ id: string }>({
      key: 'wait-timeout:1',
      lockTtlSec: 0.3,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async () => {
        throw new Error('should not run: lock is never released')
      },
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('follower')
    expect(fakeRedis.delCalls).not.toContain(resultKey)

    // resultKey is checked before lockKey in the follower's poll loop, so
    // publishing it resolves `result` without needing to free the stuck lock.
    await fakeRedis.set(resultKey, 'someone-elses-result')
    await expect(result).resolves.toEqual({ id: 'someone-elses-result' })
  })
})

describe('AiInFlightService — force leader clears stale stream state', () => {
  it('deletes resultKey, streamKey, and errorKey after acquiring the lock', async () => {
    const { service, fakeRedis } = await buildService()
    const streamKey = 'ai:stream:stale-frames:1:stream'
    const errorKey = 'ai:stream:stale-frames:1:error'
    const resultKey = 'ai:stream:stale-frames:1:result'

    // leftovers from an earlier, unrelated run on the same key
    await fakeRedis.xadd(
      streamKey,
      'MAXLEN',
      '~',
      '100',
      '*',
      'type',
      'done',
      'data',
      JSON.stringify({ resultId: 'stale-id' }),
    )
    await fakeRedis.set(errorKey, 'stale error')
    await fakeRedis.set(resultKey, 'stale-result')

    const { role } = await service.runWithStream<{ id: string }>({
      key: 'stale-frames:1',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async () => ({ result: { id: 'fresh' }, resultId: 'fresh' }),
      parseResult: async (id: string) => ({ id }),
    })

    expect(role).toBe('leader')
    expect(fakeRedis.delCalls).toEqual(
      expect.arrayContaining([resultKey, streamKey, errorKey]),
    )
  })

  it("a force follower joining mid-run never sees the previous run's stale done frame or error", async () => {
    const { service, fakeRedis } = await buildService()
    const streamKey = 'ai:stream:stale-frames:2:stream'
    const errorKey = 'ai:stream:stale-frames:2:error'
    const resultKey = 'ai:stream:stale-frames:2:result'

    await fakeRedis.xadd(
      streamKey,
      'MAXLEN',
      '~',
      '100',
      '*',
      'type',
      'done',
      'data',
      JSON.stringify({ resultId: 'stale-id' }),
    )
    await fakeRedis.set(errorKey, 'stale error')
    await fakeRedis.set(resultKey, 'stale-result')

    let releaseLeader: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseLeader = resolve
    })

    const leaderRun = await service.runWithStream<{ id: string }>({
      key: 'stale-frames:2',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async ({ push }) => {
        await gate
        await push({ type: 'token', data: 'fresh' })
        return { result: { id: 'fresh' }, resultId: 'fresh' }
      },
      parseResult: async (id: string) => ({ id }),
    })
    expect(leaderRun.role).toBe('leader')

    // a second force request joins as a follower while the leader still
    // holds the lock (the gate above hasn't been released yet)
    const followerRun = await service.runWithStream<{ id: string }>({
      key: 'stale-frames:2',
      lockTtlSec: 5,
      resultTtlSec: 60,
      streamMaxLen: 100,
      readBlockMs: 10,
      idleTimeoutMs: 1000,
      bypassResultCache: true,
      onLeader: async () => {
        throw new Error('should not run: joins the existing force leader')
      },
      parseResult: async (id: string) => ({ id }),
    })
    expect(followerRun.role).toBe('follower')

    const collectPromise = (async () => {
      const collected: AiStreamEvent[] = []
      for await (const event of followerRun.events) {
        collected.push(event)
      }
      return collected
    })()

    releaseLeader()

    const collected = await collectPromise
    expect(collected).toEqual([
      { type: 'token', data: 'fresh' },
      { type: 'done', data: { resultId: 'fresh' } },
    ])
    await expect(followerRun.result).resolves.toEqual({ id: 'fresh' })
    await expect(leaderRun.result).resolves.toEqual({ id: 'fresh' })
  })
})
