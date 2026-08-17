import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
  DEFAULT_PUSH_PREFERENCES,
  type PushEvent,
  type PushPreferences,
} from '@mx-space/push-protocol'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applyPushRelayMigrations } from '../src/apply-migrations.js'
import { PostgresPushRelayStore } from '../src/postgres-store.js'

const databaseUrl = process.env.PUSH_RELAY_TEST_DATABASE_URL?.trim()
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../migrations',
)

const hexHash = (seed: string) =>
  seed
    .padEnd(64, '0')
    .slice(0, 64)
    .replaceAll(/[^\da-f]/g, 'a')

const envelope = {
  specversion: '1.0' as const,
  time: '2026-08-17T12:00:00.000Z',
  datacontenttype: 'application/json' as const,
}

const commentCreated = (sourceId: string, id: string): PushEvent => ({
  ...envelope,
  id,
  source: `urn:mx-core:instance:${sourceId}`,
  type: COMMENT_CREATED_EVENT,
  subject: `comment/${id}`,
  data: { resource_id: id, resource_type: 'comment' },
})

const contentPublished = (
  sourceId: string,
  resourceType: 'post' | 'note' | 'recently',
  id: string,
): PushEvent => ({
  ...envelope,
  id,
  source: `urn:mx-core:instance:${sourceId}`,
  type: CONTENT_PUBLISHED_EVENT,
  subject: `${resourceType}/${id}`,
  data: { resource_id: id, resource_type: resourceType },
})

const commentReplied = (
  sourceId: string,
  id: string,
  recipientReaderId: string,
): PushEvent => ({
  ...envelope,
  id,
  source: `urn:mx-core:instance:${sourceId}`,
  type: COMMENT_REPLIED_EVENT,
  subject: `comment/${id}`,
  data: {
    resource_id: id,
    resource_type: 'comment',
    recipient_reader_id: recipientReaderId,
  },
})

const prefs = (overrides: Partial<PushPreferences> = {}): PushPreferences => ({
  ...DEFAULT_PUSH_PREFERENCES,
  ...overrides,
})

describe.skipIf(!databaseUrl)('PostgresPushRelayStore integration', () => {
  const schema = `push_relay_it_${randomUUID().replaceAll('-', '')}`
  let pool: Pool
  let store: PostgresPushRelayStore

  beforeAll(async () => {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 4,
      options: `-c search_path=${schema},public`,
    })
    await pool.query(`CREATE SCHEMA ${schema}`)
    const client = await pool.connect()
    try {
      await applyPushRelayMigrations(client, { migrationsDir })
    } finally {
      client.release()
    }
    store = new PostgresPushRelayStore(pool)
  })

  afterAll(async () => {
    if (!pool) return
    const admin = new Pool({ connectionString: databaseUrl, max: 1 })
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    } finally {
      await admin.end()
      await pool.end()
    }
  })

  const createInstallation = async (appId: string) => {
    const id = `ins_${randomUUID()}`
    await store.createInstallation({
      id,
      appId,
      apnsEnvironment: 'development',
      tokenHash: hexHash(id),
      tokenCiphertext: `cipher_${id}`,
      secretHash: hexHash(`secret_${id}`),
    })
    return id
  }

  const createSource = async () => {
    const id = `src_${randomUUID()}`
    await store.createSource({
      id,
      origin: 'https://core.example.com',
      label: 'integration',
      secretCiphertext: `cipher_${id}`,
    })
    return id
  }

  const deliveryTargets = async (eventId: string, sourceId: string) => {
    const result = await pool.query<{
      app_id: string
      reader_id: string | null
    }>(
      `SELECT i.app_id, b.reader_id
       FROM push_deliveries d
       JOIN push_installations i ON i.id = d.installation_id
       JOIN push_bindings b ON b.id = d.binding_id
       WHERE d.source_id = $1 AND d.event_id = $2
       ORDER BY i.app_id, b.reader_id`,
      [sourceId, eventId],
    )
    return result.rows
  }

  const bindingRow = async (bindingId: string) => {
    const row = await pool.query<{
      reader_id: string | null
      preferences: PushPreferences
      revoked_at: Date | null
    }>(
      `SELECT reader_id, preferences, revoked_at FROM push_bindings WHERE id = $1`,
      [bindingId],
    )
    return row.rows[0]
  }

  it('reactivates the same source+installation binding and replaces reader metadata', async () => {
    const sourceId = await createSource()
    const installationId = await createInstallation('yohaku')
    const firstId = await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId,
      readerId: 'reader_old',
      preferences: prefs(),
    })
    expect(await store.revokeBinding(sourceId, firstId, new Date())).toBe(true)

    const secondId = await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId,
      readerId: 'reader_new',
      preferences: prefs({ content_post: false }),
    })
    expect(secondId).toBe(firstId)
    expect(await bindingRow(firstId)).toMatchObject({
      reader_id: 'reader_new',
      revoked_at: null,
    })
  })

  it('keeps device preferences when a claim upserts the binding and clears reader_id', async () => {
    const sourceId = await createSource()
    const installationId = await createInstallation('yohaku')
    const bindingId = await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId,
      readerId: 'reader_old',
      preferences: prefs(),
    })
    const devicePreferences = prefs({
      content_post: false,
      comment_replied: false,
    })
    await expect(
      store.updateBindingPreferencesForInstallation({
        installationId,
        bindingId,
        preferences: devicePreferences,
      }),
    ).resolves.toBe(true)

    const reclaimedId = await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId,
      readerId: null,
      preferences: prefs(),
    })
    expect(reclaimedId).toBe(bindingId)
    expect(await bindingRow(bindingId)).toMatchObject({
      reader_id: null,
      preferences: devicePreferences,
      revoked_at: null,
    })
  })

  it('scopes binding lookup, preference updates, and revocation to the owning installation', async () => {
    const sourceId = await createSource()
    const installationId = await createInstallation('yohaku')
    const otherInstallationId = await createInstallation('yohaku')
    const bindingId = await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId,
      readerId: 'reader_1',
      preferences: prefs(),
    })

    await expect(
      store.findBindingForInstallation(installationId, bindingId),
    ).resolves.toMatchObject({
      id: bindingId,
      sourceId,
      installationId,
      readerId: 'reader_1',
      preferences: prefs(),
      revokedAt: null,
    })
    await expect(
      store.findBindingForInstallation(otherInstallationId, bindingId),
    ).resolves.toBeNull()

    await expect(
      store.updateBindingPreferencesForInstallation({
        installationId: otherInstallationId,
        bindingId,
        preferences: prefs({ content_note: false }),
      }),
    ).resolves.toBe(false)
    await expect(
      store.revokeBindingForInstallation(
        otherInstallationId,
        bindingId,
        new Date(),
      ),
    ).resolves.toBe(false)
    expect(await bindingRow(bindingId)).toMatchObject({
      preferences: prefs(),
      revoked_at: null,
    })

    await expect(
      store.revokeBindingForInstallation(installationId, bindingId, new Date()),
    ).resolves.toBe(true)
    await expect(
      store.findBindingForInstallation(installationId, bindingId),
    ).resolves.toBeNull()
    await expect(
      store.revokeBindingForInstallation(installationId, bindingId, new Date()),
    ).resolves.toBe(false)
  })

  it('does not update preferences on a revoked binding', async () => {
    const sourceId = await createSource()
    const installationId = await createInstallation('yohaku')
    const bindingId = await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId,
      readerId: 'reader_1',
      preferences: prefs(),
    })
    await store.revokeBinding(sourceId, bindingId, new Date())

    await expect(
      store.updateBindingPreferencesForInstallation({
        installationId,
        bindingId,
        preferences: prefs({ comment_replied: false }),
      }),
    ).resolves.toBe(false)
    expect((await bindingRow(bindingId))?.preferences).toEqual(prefs())
  })

  it('fans out Space comments, Yohaku content preferences, and targeted replies', async () => {
    const sourceId = await createSource()
    const spaceId = await createInstallation('space')
    const yohakuPostId = await createInstallation('yohaku')
    const yohakuQuietId = await createInstallation('yohaku')
    const yohakuOtherReaderId = await createInstallation('yohaku')
    await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId: spaceId,
      readerId: null,
      preferences: prefs(),
    })
    await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId: yohakuPostId,
      readerId: 'reader_1',
      preferences: prefs({ content_note: false }),
    })
    await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId: yohakuQuietId,
      readerId: 'reader_1',
      preferences: prefs({
        content_post: false,
        content_note: false,
        content_recently: false,
        comment_replied: false,
      }),
    })
    await store.createBinding({
      id: `bnd_${randomUUID()}`,
      sourceId,
      installationId: yohakuOtherReaderId,
      readerId: 'reader_2',
      preferences: prefs(),
    })

    const now = new Date('2026-08-17T12:00:00.000Z')
    const commentEvent = commentCreated(sourceId, `c_${randomUUID()}`)
    await expect(
      store.acceptEvent({
        id: commentEvent.id,
        sourceId,
        deliveryId: `dlv_${randomUUID()}`,
        event: commentEvent,
        now,
      }),
    ).resolves.toEqual({ accepted: true, deliveries: 1 })
    expect(await deliveryTargets(commentEvent.id, sourceId)).toEqual([
      { app_id: 'space', reader_id: null },
    ])

    const postEvent = contentPublished(sourceId, 'post', `p_${randomUUID()}`)
    await expect(
      store.acceptEvent({
        id: postEvent.id,
        sourceId,
        deliveryId: `dlv_${randomUUID()}`,
        event: postEvent,
        now,
      }),
    ).resolves.toEqual({ accepted: true, deliveries: 2 })
    expect(await deliveryTargets(postEvent.id, sourceId)).toEqual([
      { app_id: 'yohaku', reader_id: 'reader_1' },
      { app_id: 'yohaku', reader_id: 'reader_2' },
    ])

    const noteEvent = contentPublished(sourceId, 'note', `n_${randomUUID()}`)
    await expect(
      store.acceptEvent({
        id: noteEvent.id,
        sourceId,
        deliveryId: `dlv_${randomUUID()}`,
        event: noteEvent,
        now,
      }),
    ).resolves.toEqual({ accepted: true, deliveries: 1 })
    expect(await deliveryTargets(noteEvent.id, sourceId)).toEqual([
      { app_id: 'yohaku', reader_id: 'reader_2' },
    ])

    const replyEvent = commentReplied(sourceId, `r_${randomUUID()}`, 'reader_1')
    await expect(
      store.acceptEvent({
        id: replyEvent.id,
        sourceId,
        deliveryId: `dlv_${randomUUID()}`,
        event: replyEvent,
        now,
      }),
    ).resolves.toEqual({ accepted: true, deliveries: 1 })
    expect(await deliveryTargets(replyEvent.id, sourceId)).toEqual([
      { app_id: 'yohaku', reader_id: 'reader_1' },
    ])
  })
})
