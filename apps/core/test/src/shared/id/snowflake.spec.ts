import {
  resolveSnowflakeWorkerId,
  SNOWFLAKE_EPOCH_MS,
  SNOWFLAKE_WORKER_OFFSET_ENV,
  SnowflakeGenerator,
} from '~/shared/id/snowflake.service'

const FIXED_NOW = Number(SNOWFLAKE_EPOCH_MS) + 1_000_000

function buildGenerator(
  opts: Partial<{ workerId: number; now: () => number }> = {},
) {
  let current = opts.now?.() ?? FIXED_NOW
  return {
    generator: new SnowflakeGenerator({
      workerId: opts.workerId ?? 1,
      epochMs: SNOWFLAKE_EPOCH_MS,
      now: opts.now ?? (() => current),
    }),
    advance(by: number) {
      current += by
    },
    setNow(value: number) {
      current = value
    },
    get now() {
      return current
    },
  }
}

describe('SnowflakeGenerator', () => {
  it('rejects worker ID outside [0, 1023]', () => {
    expect(() => new SnowflakeGenerator({ workerId: -1 })).toThrow()
    expect(() => new SnowflakeGenerator({ workerId: 1024 })).toThrow()
    expect(() => new SnowflakeGenerator({ workerId: 1.5 })).toThrow()
  })

  it('produces strictly monotonically increasing IDs in the same millisecond', () => {
    const env = buildGenerator()
    const ids: bigint[] = []
    for (let i = 0; i < 100; i++) ids.push(env.generator.nextBigInt())
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1])
    }
  })

  it('serializes IDs as positive decimal strings within bigint range', () => {
    const env = buildGenerator({ workerId: 7 })
    const id = env.generator.nextId()
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[1-9]\d*$/)
    expect(BigInt(id)).toBeLessThanOrEqual(9_223_372_036_854_775_807n)
  })

  it('decodes timestamp, worker ID, and sequence back from generated ID', () => {
    const env = buildGenerator({ workerId: 42 })
    const id = env.generator.nextBigInt()
    const decoded = env.generator.decode(id)
    expect(decoded.workerId).toBe(42n)
    expect(decoded.timestampMs).toBe(BigInt(env.now))
    expect(decoded.sequence).toBe(0n)
  })

  it('rolls sequence when 4096 IDs are issued in the same millisecond', () => {
    const frozen = FIXED_NOW
    let advanced = false
    const generator = new SnowflakeGenerator({
      workerId: 3,
      epochMs: SNOWFLAKE_EPOCH_MS,
      // Block on the 4097th call until clock advances by 1ms.
      now: () => {
        if (!advanced) return frozen
        return frozen + 1
      },
    })

    const ids = new Set<string>()
    for (let i = 0; i < 4096; i++) {
      ids.add(generator.nextId())
    }
    expect(ids.size).toBe(4096)

    advanced = true
    const next = generator.nextBigInt()
    expect(generator.decode(next).timestampMs).toBe(BigInt(frozen + 1))
  })

  it('throws when the clock moves backwards by default', () => {
    const env = buildGenerator()
    env.generator.nextBigInt()
    env.setNow(env.now - 5)
    expect(() => env.generator.nextBigInt()).toThrow(/clock moved backwards/)
  })

  it('waits when clock drift is within the configured tolerance', () => {
    let calls = 0
    const ahead = FIXED_NOW + 500
    // Sequence: first call returns ahead (advance generator state),
    // then jump back by 2ms; the generator should poll until it catches up.
    const sequence = [ahead, ahead - 2, ahead - 1, ahead, ahead + 1]
    const generator = new SnowflakeGenerator({
      workerId: 5,
      epochMs: SNOWFLAKE_EPOCH_MS,
      toleratesBackwardsClockMs: 5,
      now: () => sequence[Math.min(calls++, sequence.length - 1)],
    })
    generator.nextBigInt() // primes lastTimestamp at `ahead`
    const id = generator.nextBigInt()
    expect(id).toBeGreaterThan(0n)
    const decoded = generator.decode(id)
    expect(decoded.timestampMs).toBeGreaterThanOrEqual(BigInt(ahead))
  })

  it('rejects timestamps before the configured epoch', () => {
    const generator = new SnowflakeGenerator({
      workerId: 0,
      epochMs: SNOWFLAKE_EPOCH_MS,
      now: () => Number(SNOWFLAKE_EPOCH_MS) - 1,
    })
    expect(() => generator.nextBigInt()).toThrow(/before epoch/)
  })

  it('uses the worker ID bits exactly', () => {
    const env = buildGenerator({ workerId: 1023 })
    const decoded = env.generator.decode(env.generator.nextBigInt())
    expect(decoded.workerId).toBe(1023n)
  })

  it('derives an effective worker ID from cluster and PM2 offsets', () => {
    expect(
      resolveSnowflakeWorkerId(10, {
        [SNOWFLAKE_WORKER_OFFSET_ENV]: '2',
      }),
    ).toBe(12)
    expect(resolveSnowflakeWorkerId(10, { NODE_APP_INSTANCE: '3' })).toBe(13)
    expect(
      resolveSnowflakeWorkerId(10, {
        [SNOWFLAKE_WORKER_OFFSET_ENV]: '4',
        NODE_APP_INSTANCE: '3',
      }),
    ).toBe(14)
  })

  it('rejects effective worker IDs outside the Snowflake worker range', () => {
    expect(() =>
      resolveSnowflakeWorkerId(1023, {
        [SNOWFLAKE_WORKER_OFFSET_ENV]: '1',
      }),
    ).toThrow(/out of range/)
    expect(() =>
      resolveSnowflakeWorkerId(1, {
        [SNOWFLAKE_WORKER_OFFSET_ENV]: 'bad',
      }),
    ).toThrow(/non-negative integer/)
  })
})
