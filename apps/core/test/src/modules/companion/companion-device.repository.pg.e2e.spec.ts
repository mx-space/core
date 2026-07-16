import { randomUUID } from 'node:crypto'

import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CompanionCredentialService } from '~/modules/companion/companion-credential.service'
import { CompanionDeviceRepository } from '~/modules/companion/companion-device.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

describe('Companion pairing consumption (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let repository: CompanionDeviceRepository
  const credentials = new CompanionCredentialService()
  const ownerId = 'companion-owner'

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    repository = new CompanionDeviceRepository(db)
    await db.insert(schema.readers).values({
      id: ownerId,
      name: 'Companion Owner',
      role: 'owner',
    })
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('atomically lets exactly one concurrent claim create a device and never stores plaintext credentials', async () => {
    const pairing = credentials.createPairingCredential()
    const now = new Date()
    await repository.createPairing({
      id: randomUUID(),
      ownerId,
      codeHash: pairing.codeHash,
      scopes: ['companion:presence:write'],
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    })

    const first = credentials.createDeviceCredential()
    const second = credentials.createDeviceCredential()
    const claims = await Promise.all([
      repository.claimPairing({
        codeHash: pairing.codeHash,
        claimedAt: now,
        device: {
          id: first.deviceId,
          name: 'First Mac',
          tokenHash: first.tokenHash,
        },
      }),
      repository.claimPairing({
        codeHash: pairing.codeHash,
        claimedAt: now,
        device: {
          id: second.deviceId,
          name: 'Second Mac',
          tokenHash: second.tokenHash,
        },
      }),
    ])

    const accepted = claims.filter((claim) => claim !== null)
    expect(accepted).toHaveLength(1)
    const device = accepted[0]!.device
    expect(device.tokenHash).toMatch(/^[\da-f]{64}$/)
    expect(device.tokenHash).not.toBe(first.token)
    expect(device.tokenHash).not.toBe(second.token)

    await expect(
      repository.claimPairing({
        codeHash: pairing.codeHash,
        claimedAt: new Date(now.getTime() + 1),
        device: {
          id: randomUUID(),
          name: 'Replay Mac',
          tokenHash: credentials.createDeviceCredential().tokenHash,
        },
      }),
    ).resolves.toBeNull()

    await expect(
      repository.markPresenceCleared(device.id, now),
    ).resolves.toBeNull()

    const firstRevokedAt = new Date(now.getTime() + 1000)
    const firstRevoke = await repository.revokeDevice(
      ownerId,
      device.id,
      firstRevokedAt,
    )
    expect(firstRevoke?.presenceClearedAt).toBeNull()
    await expect(repository.listDevicesPendingPresenceClear()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: device.id })]),
    )

    const presenceClearedAt = new Date(now.getTime() + 1500)
    const cleared = await repository.markPresenceCleared(
      device.id,
      presenceClearedAt,
    )
    const retryRevoke = await repository.revokeDevice(
      ownerId,
      device.id,
      new Date(now.getTime() + 2000),
    )
    expect(firstRevoke?.revokedAt?.toISOString()).toBe(
      firstRevokedAt.toISOString(),
    )
    expect(retryRevoke?.revokedAt?.toISOString()).toBe(
      firstRevokedAt.toISOString(),
    )
    expect(cleared?.presenceClearedAt?.toISOString()).toBe(
      presenceClearedAt.toISOString(),
    )
    expect(retryRevoke?.presenceClearedAt?.toISOString()).toBe(
      presenceClearedAt.toISOString(),
    )
    await expect(
      repository.markPresenceCleared(device.id, new Date(now.getTime() + 3000)),
    ).resolves.toBeNull()
    await expect(
      repository.listDevicesPendingPresenceClear(),
    ).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: device.id })]),
    )
  })

  it('does not consume or create a device from an expired pairing', async () => {
    const pairing = credentials.createPairingCredential()
    const createdAt = new Date()
    await repository.createPairing({
      id: randomUUID(),
      ownerId,
      codeHash: pairing.codeHash,
      scopes: ['companion:presence:write'],
      expiresAt: new Date(createdAt.getTime() + 1000),
    })
    const device = credentials.createDeviceCredential()

    await expect(
      repository.claimPairing({
        codeHash: pairing.codeHash,
        claimedAt: new Date(createdAt.getTime() + 2000),
        device: {
          id: device.deviceId,
          name: 'Late Mac',
          tokenHash: device.tokenHash,
        },
      }),
    ).resolves.toBeNull()
    await expect(repository.findDeviceById(device.deviceId)).resolves.toBeNull()
  })
})
