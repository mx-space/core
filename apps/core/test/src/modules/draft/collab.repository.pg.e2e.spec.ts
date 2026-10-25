import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CollabRepository } from '~/modules/draft/collab.repository'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { DraftRepository } from '~/modules/draft/draft.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

const snapshot = {
  content: null,
  contentFormat: 'lexical',
  images: null,
  meta: null,
  text: 'Root',
  title: 'Root',
  typeSpecificData: null,
}

const later = (ms: number) => new Date(Date.now() + ms)

describe('CollabRepository (real PG)', () => {
  let pool: Pool
  let db: AppDatabase
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let drafts: DraftRepository
  let repository: CollabRepository
  let readerSeq = 0

  const seedDocument = async () =>
    (
      await drafts.createDocumentWithRoot(
        DraftRefType.Post,
        null,
        snapshot,
        false,
      )
    ).document.id

  const seedReader = async (name: string) => {
    readerSeq += 1
    const id = `reader-${readerSeq}`
    await db.insert(schema.readers).values({
      id,
      image: `https://avatars.test/${id}.png`,
      name,
    })
    return id
  }

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 45,
    }) as SnowflakeService
    drafts = new DraftRepository(db, snowflake)
    repository = new CollabRepository(db, snowflake)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('accepts an invite once per reader and counts each new reader', async () => {
    const documentId = await seedDocument()
    const alice = await seedReader('Alice')
    const bob = await seedReader('Bob')
    await repository.createInvite({
      documentId,
      expiresAt: later(60_000),
      maxUses: 3,
      tokenHash: 'hash-a',
    })

    expect(await repository.peekInvite('hash-a')).toEqual({
      documentId,
      ok: true,
    })
    expect(await repository.acceptInvite('hash-a', alice)).toEqual({
      documentId,
      ok: true,
    })
    expect(await repository.acceptInvite('hash-a', alice)).toEqual({
      documentId,
      ok: true,
    })
    expect(await repository.acceptInvite('hash-a', bob)).toEqual({
      documentId,
      ok: true,
    })

    const [invite] = await repository.listInvites(documentId)
    expect(invite.uses).toBe(2)
    expect(await repository.isCollaborator(documentId, alice)).toBe(true)
    expect(await repository.isCollaborator(documentId, bob)).toBe(true)
  })

  it('refuses expired, revoked, exhausted and unknown invites', async () => {
    const documentId = await seedDocument()
    const reader = await seedReader('Carol')
    const other = await seedReader('Dan')
    await repository.createInvite({
      documentId,
      expiresAt: later(-1000),
      maxUses: null,
      tokenHash: 'hash-expired',
    })
    const revoked = await repository.createInvite({
      documentId,
      expiresAt: later(60_000),
      maxUses: null,
      tokenHash: 'hash-revoked',
    })
    await repository.revokeInvite(documentId, revoked.id)
    await repository.createInvite({
      documentId,
      expiresAt: later(60_000),
      maxUses: 1,
      tokenHash: 'hash-once',
    })
    await repository.acceptInvite('hash-once', other)

    expect(await repository.acceptInvite('hash-expired', reader)).toEqual({
      ok: false,
      reason: 'expired',
    })
    expect(await repository.acceptInvite('hash-revoked', reader)).toEqual({
      ok: false,
      reason: 'revoked',
    })
    expect(await repository.acceptInvite('hash-once', reader)).toEqual({
      ok: false,
      reason: 'exhausted',
    })
    expect(await repository.acceptInvite('hash-none', reader)).toEqual({
      ok: false,
      reason: 'not_found',
    })
    expect(await repository.peekInvite('hash-revoked')).toEqual({
      ok: false,
      reason: 'revoked',
    })
    expect(await repository.isCollaborator(documentId, reader)).toBe(false)
    expect(await repository.listInvites(documentId)).toEqual([])
  })

  it('lists contributors who stay in the byline, in order of first edit', async () => {
    const refId = '7700000000000000009'
    const documentId = (
      await drafts.createDocumentWithRoot(
        DraftRefType.Post,
        refId,
        snapshot,
        false,
      )
    ).document.id
    const first = await seedReader('First')
    const second = await seedReader('Second')
    const hidden = await seedReader('Hidden')
    const idle = await seedReader('Idle')
    for (const reader of [first, second, hidden, idle]) {
      await repository.addCollaborator(documentId, reader)
    }
    await repository.markContributed(documentId, second)
    await repository.markContributed(documentId, first)
    await repository.markContributed(documentId, second)
    await repository.markContributed(documentId, hidden)
    await repository.setShowInByline(documentId, hidden, false)

    const byline = await repository.coAuthorsByRef(DraftRefType.Post, [refId])

    expect(byline.get(refId)?.map((author) => author.name)).toEqual([
      'Second',
      'First',
    ])
    expect(byline.get(refId)?.[0]).toMatchObject({
      avatar: `https://avatars.test/${second}.png`,
    })
    expect(
      (await repository.listCollaborators(documentId)).map((row) => ({
        contributed: row.contributedAt !== null,
        name: row.name,
        showInByline: row.showInByline,
      })),
    ).toEqual([
      { contributed: true, name: 'First', showInByline: true },
      { contributed: true, name: 'Second', showInByline: true },
      { contributed: true, name: 'Hidden', showInByline: false },
      { contributed: false, name: 'Idle', showInByline: true },
    ])
  })

  it('removes a collaborator and reports whether one was removed', async () => {
    const documentId = await seedDocument()
    const reader = await seedReader('Eve')
    await repository.addCollaborator(documentId, reader)

    expect(await repository.removeCollaborator(documentId, reader)).toBe(true)
    expect(await repository.removeCollaborator(documentId, reader)).toBe(false)
    expect(await repository.isCollaborator(documentId, reader)).toBe(false)
  })

  it('resolves the name, avatar and role a reader shows in the room', async () => {
    const reader = await seedReader('Frank')

    expect(await repository.presenceUserOf(reader)).toEqual({
      avatar: `https://avatars.test/${reader}.png`,
      id: reader,
      name: 'Frank',
      role: 'reader',
    })
    expect(await repository.presenceUserOf('missing')).toBeNull()
  })

  it('finds co-authors by the content the document belongs to', async () => {
    const { document } = await drafts.createDocumentWithRoot(
      DraftRefType.Post,
      '7700000000000000001',
      snapshot,
      false,
    )
    const reader = await seedReader('Grace')
    await repository.addCollaborator(document.id, reader)
    await repository.markContributed(document.id, reader)

    const byRef = await repository.coAuthorsByRef(DraftRefType.Post, [
      '7700000000000000001',
      '7700000000000000002',
    ])

    expect(byRef.get('7700000000000000001')).toEqual([
      { avatar: `https://avatars.test/${reader}.png`, name: 'Grace' },
    ])
    expect(byRef.has('7700000000000000002')).toBe(false)
  })

  it('keeps a removed reader out through old links but lets a newer link bring them back', async () => {
    const documentId = await seedDocument()
    const reader = await seedReader('Heidi')
    await repository.createInvite({
      documentId,
      expiresAt: later(60_000),
      maxUses: null,
      tokenHash: 'hash-old',
    })
    await repository.acceptInvite('hash-old', reader)
    await repository.markContributed(documentId, reader)
    await repository.removeCollaborator(documentId, reader)

    expect(await repository.acceptInvite('hash-old', reader)).toEqual({
      ok: false,
      reason: 'revoked',
    })
    expect(await repository.isCollaborator(documentId, reader)).toBe(false)
    expect(await repository.listCollaborators(documentId)).toEqual([])

    await repository.createInvite({
      documentId,
      expiresAt: later(60_000),
      maxUses: null,
      tokenHash: 'hash-new',
    })
    expect(await repository.acceptInvite('hash-new', reader)).toEqual({
      documentId,
      ok: true,
    })
    expect(await repository.isCollaborator(documentId, reader)).toBe(true)
  })
})
