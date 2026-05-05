import { createHash } from 'node:crypto'

import pkg from 'pg'

import {
  SCHEMA_MIGRATION_LOCK_KEY,
  withAdvisoryLock,
} from '~/processors/database/postgres.lock'

const { Pool } = pkg

const verifyUrl = process.env.PG_VERIFY_URL
const describeIfPg = verifyUrl ? describe : describe.skip

describe('SCHEMA_MIGRATION_LOCK_KEY', () => {
  it('matches sha256("mx-core:schema-migration:v1") first 8 bytes as signed bigint', () => {
    const h = createHash('sha256')
      .update('mx-core:schema-migration:v1')
      .digest()
    const buf = h.subarray(0, 8)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const big = view.getBigInt64(0, false)
    expect(SCHEMA_MIGRATION_LOCK_KEY).toBe(big)
  })
})

describeIfPg('withAdvisoryLock', () => {
  let poolA: pkg.Pool
  let poolB: pkg.Pool
  const TEST_KEY = 9999000000000001n

  beforeAll(async () => {
    poolA = new Pool({ connectionString: verifyUrl, max: 2 })
    poolB = new Pool({ connectionString: verifyUrl, max: 2 })
  })

  afterAll(async () => {
    await poolA.end()
    await poolB.end()
  })

  it('blocks a second holder until the first releases', async () => {
    let firstReleased = false
    let secondAcquiredAt = 0
    let firstReleasedAt = 0

    const first = withAdvisoryLock(poolA, TEST_KEY, async () => {
      // hold for 300ms
      await new Promise((resolve) => setTimeout(resolve, 300))
      firstReleasedAt = Date.now()
      firstReleased = true
    })

    // small delay to ensure first acquires before second
    await new Promise((resolve) => setTimeout(resolve, 50))

    const second = withAdvisoryLock(poolB, TEST_KEY, async () => {
      secondAcquiredAt = Date.now()
      expect(firstReleased).toBe(true)
    })

    await Promise.all([first, second])
    expect(secondAcquiredAt).toBeGreaterThanOrEqual(firstReleasedAt)
  }, 10_000)

  it('releases the lock even if the body throws', async () => {
    const err = new Error('boom')
    await expect(
      withAdvisoryLock(poolA, TEST_KEY, async () => {
        throw err
      }),
    ).rejects.toBe(err)

    // a subsequent acquire should succeed quickly (no leftover hold)
    let acquired = false
    await withAdvisoryLock(poolA, TEST_KEY, async () => {
      acquired = true
    })
    expect(acquired).toBe(true)
  })
})
