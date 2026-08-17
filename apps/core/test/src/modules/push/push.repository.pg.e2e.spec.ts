import * as schema from '@mx-space/db-schema/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PushRepository } from '~/modules/push/push.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

describe('PushRepository anonymous relay bindings (real PG)', () => {
  let pool: Pool
  let db: AppDatabase
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let repository: PushRepository
  const readerId = 'reader-binding-1'

  const activation = (overrides: {
    readerId: string | null
    remoteBindingId: string
    installationId: string
  }) => ({
    relayUrl: 'https://push.example.com',
    remoteSourceId: 'remote-source',
    sourceSecret: null,
    eventEndpoint: 'https://push.example.com/v1/webhooks/mx-core',
    ...overrides,
  })

  const ownerIdOf = async (bindingId: string) => {
    const [row] = await db
      .select({ ownerId: schema.pushRelayBindings.ownerId })
      .from(schema.pushRelayBindings)
      .where(eq(schema.pushRelayBindings.id, bindingId))
    return row?.ownerId ?? null
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    repository = new PushRepository(db)
    await db
      .insert(schema.readers)
      .values([{ id: readerId, name: 'Reader One', role: 'reader' }])
    await db.insert(schema.pushRelaySources).values({
      id: 'src_bindings',
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

  it('persists an activation with no reader association at all', async () => {
    const binding = await repository.saveActivation(
      activation({
        readerId: null,
        remoteBindingId: 'remote-anon',
        installationId: 'inst-anon',
      }),
    )

    expect(binding.readerId).toBeNull()
    await expect(ownerIdOf(binding.id)).resolves.toBeNull()
  })

  it('treats an anonymous binding as an active source for event dispatch', async () => {
    const sources = await repository.listEnabledSources()
    expect(sources.map((source) => source.id)).toContain('src_bindings')
  })

  it('associates and then clears the reader when the same device re-activates', async () => {
    const associated = await repository.saveActivation(
      activation({
        readerId,
        remoteBindingId: 'remote-device',
        installationId: 'inst-device',
      }),
    )
    expect(associated.readerId).toBe(readerId)
    await expect(ownerIdOf(associated.id)).resolves.toBe(readerId)

    const reassociated = await repository.saveActivation(
      activation({
        readerId: null,
        remoteBindingId: 'remote-device-2',
        installationId: 'inst-device',
      }),
    )
    expect(reassociated.id).toBe(associated.id)
    expect(reassociated.readerId).toBeNull()
    expect(reassociated.remoteBindingId).toBe('remote-device-2')
    await expect(ownerIdOf(associated.id)).resolves.toBeNull()
  })

  it('keeps the binding after its associated reader is deleted', async () => {
    const binding = await repository.saveActivation(
      activation({
        readerId,
        remoteBindingId: 'remote-orphan',
        installationId: 'inst-orphan',
      }),
    )
    await db.delete(schema.readers).where(eq(schema.readers.id, readerId))

    await expect(ownerIdOf(binding.id)).resolves.toBeNull()
  })

  it('no longer exposes the reader-scoped preference and binding queries', () => {
    const surface = repository as unknown as Record<string, unknown>
    for (const removed of [
      'getOrDefaultPreferences',
      'upsertPreferences',
      'listActiveBindingsForReader',
      'findActiveBinding',
      'findOwnedActiveBinding',
      'findLatestSourceForReader',
      'revokeBinding',
    ]) {
      expect(surface[removed]).toBeUndefined()
    }
  })
})
