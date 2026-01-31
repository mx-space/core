import { Test } from '@nestjs/testing'
import { BizException } from '~/common/exceptions/biz.exception'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { RedisService } from '~/processors/redis/redis.service'
import { describe, expect, it } from 'vitest'

class FakeRedis {
  private store = new Map<string, string>()
  private streams = new Map<string, Array<[string, string[]]>>()
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

describe('AiInFlightService', () => {
  it('runs leader flow and yields token + done events', async () => {
    const fakeRedis = new FakeRedis()
    const module = await Test.createTestingModule({
      providers: [
        AiInFlightService,
        { provide: RedisService, useValue: { getClient: () => fakeRedis } },
      ],
    }).compile()

    const service = module.get(AiInFlightService)
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

  it('runs follower flow and replays stream', async () => {
    const fakeRedis = new FakeRedis()
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
    const module = await Test.createTestingModule({
      providers: [
        AiInFlightService,
        { provide: RedisService, useValue: { getClient: () => fakeRedis } },
      ],
    }).compile()

    const service = module.get(AiInFlightService)
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

  it('fails fast when lock missing and no result', async () => {
    const fakeRedis = new FakeRedis()
    // Set lock first so this instance becomes a follower
    await fakeRedis.set('ai:stream:missing:lock', 'some-leader')

    const module = await Test.createTestingModule({
      providers: [
        AiInFlightService,
        { provide: RedisService, useValue: { getClient: () => fakeRedis } },
      ],
    }).compile()

    const service = module.get(AiInFlightService)
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

    // Delete lock to simulate leader crash
    await fakeRedis.del('ai:stream:missing:lock')

    // Consume result promise to avoid unhandled rejection
    result.catch(() => {})

    let caught: unknown = null
    try {
      for await (const _ of events) {
        // no-op
      }
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BizException)
  })
})
