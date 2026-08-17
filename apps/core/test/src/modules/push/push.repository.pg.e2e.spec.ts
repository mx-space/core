import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PushRepository } from '~/modules/push/push.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

describe('PushRepository reader preferences (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let repository: PushRepository
  const readerId = 'reader-prefs-1'
  const otherReaderId = 'reader-prefs-2'

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    repository = new PushRepository(db)
    await db.insert(schema.readers).values([
      { id: readerId, name: 'Reader One', role: 'reader' },
      { id: otherReaderId, name: 'Reader Two', role: 'reader' },
    ])
    await db.insert(schema.pushRelaySources).values({
      id: 'src_prefs',
      relayUrl: 'https://push.example.com',
      remoteSourceId: 'remote-source',
      sourceSecret: 'encrypted-secret',
      eventEndpoint: 'https://push.example.com/v1/webhooks/mx-core',
      enabled: true,
    })
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('returns default preferences when no row exists', async () => {
    await expect(repository.getOrDefaultPreferences(readerId)).resolves.toEqual(
      {
        contentPost: true,
        contentNote: true,
        contentRecently: true,
        commentReplied: true,
      },
    )
  })

  it('upserts a partial preference change and lists only that reader’s active bindings', async () => {
    await repository.saveActivation({
      readerId,
      relayUrl: 'https://push.example.com',
      remoteSourceId: 'remote-source',
      sourceSecret: null,
      eventEndpoint: 'https://push.example.com/v1/webhooks/mx-core',
      remoteBindingId: 'remote-a',
      installationId: 'inst-a',
    })
    await repository.saveActivation({
      readerId,
      relayUrl: 'https://push.example.com',
      remoteSourceId: 'remote-source',
      sourceSecret: null,
      eventEndpoint: 'https://push.example.com/v1/webhooks/mx-core',
      remoteBindingId: 'remote-b',
      installationId: 'inst-b',
    })
    await repository.saveActivation({
      readerId: otherReaderId,
      relayUrl: 'https://push.example.com',
      remoteSourceId: 'remote-source',
      sourceSecret: null,
      eventEndpoint: 'https://push.example.com/v1/webhooks/mx-core',
      remoteBindingId: 'remote-other',
      installationId: 'inst-other',
    })

    const stored = await repository.upsertPreferences(readerId, {
      contentPost: false,
      contentNote: true,
      contentRecently: true,
      commentReplied: false,
    })
    expect(stored).toEqual({
      contentPost: false,
      contentNote: true,
      contentRecently: true,
      commentReplied: false,
    })
    await expect(repository.getOrDefaultPreferences(readerId)).resolves.toEqual(
      stored,
    )

    const bindings = await repository.listActiveBindingsForReader(readerId)
    expect(bindings.map((binding) => binding.remoteBindingId).sort()).toEqual([
      'remote-a',
      'remote-b',
    ])

    const latest = await repository.findActiveBinding(readerId)
    expect(latest?.remoteBindingId).toBe('remote-b')
    const older = bindings.find(
      (binding) => binding.remoteBindingId === 'remote-a',
    )
    expect(older).toBeTruthy()
    const owned = await repository.findOwnedActiveBinding(readerId, older!.id)
    expect(owned?.remoteBindingId).toBe('remote-a')
    await expect(
      repository.findOwnedActiveBinding(otherReaderId, older!.id),
    ).resolves.toBeNull()

    await repository.revokeBinding(readerId, older!.id)
    const remaining = await repository.listActiveBindingsForReader(readerId)
    expect(remaining.map((binding) => binding.remoteBindingId)).toEqual([
      'remote-b',
    ])
    await expect(repository.findActiveBinding(readerId)).resolves.toMatchObject(
      {
        remoteBindingId: 'remote-b',
      },
    )
  })
})
