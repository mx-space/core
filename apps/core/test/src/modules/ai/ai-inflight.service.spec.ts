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
  private streamSeq = 0

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string, ...args: any[]) {
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
    this.store.delete(key)
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
})
