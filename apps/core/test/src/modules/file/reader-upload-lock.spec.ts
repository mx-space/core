import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { expect, it } from 'vitest'

import { FileReferenceRepository } from '~/modules/file/file-reference.repository'

it('serializes the full upload accounting interval across replicas', async () => {
  const database = await createIsolatedPgDatabase()
  const pool = new Pool({
    connectionString: database.getConnectionUri(),
    max: 4,
  })
  const repository = new FileReferenceRepository(
    drizzle(pool, { schema }) as any,
    {} as any,
  )
  let release!: () => void
  let entered!: () => void
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  const holding = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const first = (repository as any).withReaderUploadLock(
      'reader-1',
      async () => {
        entered()
        await holding
      },
    )
    await started
    await expect(
      (repository as any).withReaderUploadLock(
        'reader-1',
        async () => 'overlap',
      ),
    ).rejects.toThrow()
    release()
    await first
    expect(
      await (repository as any).withReaderUploadLock(
        'reader-1',
        async () => 'released',
      ),
    ).toBe('released')
  } finally {
    release?.()
    await pool.end()
    await database.drop()
  }
}, 30_000)
