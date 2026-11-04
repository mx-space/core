import { Client } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { expect, it } from 'vitest'

it('waits for a closing connection before dropping an isolated database', async () => {
  const database = await createIsolatedPgDatabase()
  const client = new Client({ connectionString: database.getConnectionUri() })
  const errors: Error[] = []
  let dropped = false
  client.on('error', (error) => errors.push(error))
  await client.connect()
  // pg-pool.end() can resolve before its clients finish disconnecting.
  // Keep that interval observable while the database teardown begins.
  const closing = new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      void client.end().then(resolve, reject)
    }, 100)
  })

  try {
    await database.drop()
    dropped = true
    await closing
    expect(errors).toEqual([])
  } finally {
    await client.end()
    await closing
    if (!dropped) await database.drop()
  }
})
