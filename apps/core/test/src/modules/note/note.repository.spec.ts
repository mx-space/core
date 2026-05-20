import type { Pool } from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import { notes } from '~/database/schema'
import { NoteRepository } from '~/modules/note/note.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import { ContentFormat } from '~/shared/types/content-format.type'

describe('NoteRepository', () => {
  let context: PgTestDatabase
  let pool: Pool
  let db: PgTestDatabase['db']
  let repository: NoteRepository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_note')
    pool = context.pool
    db = context.db
    snowflake = new SnowflakeService()
    repository = new NoteRepository(db as any, snowflake)
  }, 60_000)

  beforeEach(async () => {
    await pool.query('truncate table notes restart identity cascade')
  })

  afterAll(async () => {
    if (context) await context.close()
  })

  it('uses the notes.nid identity sequence for consecutive creates', async () => {
    const first = await repository.create({
      title: 'First',
      contentFormat: ContentFormat.Markdown,
    })
    const second = await repository.create({
      title: 'Second',
      contentFormat: ContentFormat.Markdown,
    })

    expect(first.nid).toBe(1)
    expect(second.nid).toBe(2)
  })

  it('continues after the existing max nid once the identity sequence is aligned', async () => {
    await db.insert(notes).values({
      id: snowflake.nextId(),
      nid: 41,
      title: 'Imported',
      contentFormat: ContentFormat.Markdown,
    })

    await pool.query(`
      select setval(
        pg_get_serial_sequence('notes', 'nid'),
        (select coalesce(max(nid), 0) + 1 from notes),
        false
      )
    `)

    const created = await repository.create({
      title: 'After import',
      contentFormat: ContentFormat.Markdown,
    })

    expect(created.nid).toBe(42)
  })
})
