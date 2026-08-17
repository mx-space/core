import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { describe, expect, it } from 'vitest'

import { runSchemaMigrationFiles } from '~/processors/database/schema-migrator'

const migrationsDir = path.resolve(
  __dirname,
  '../../../src/database/migrations',
)

// The push migration was first authored on this branch as an expand-only
// `push_reader_preferences` table, then rewritten once Relay took ownership of
// device preferences. Any database that applied the abandoned revision carries
// its hash in the drizzle ledger, which is exactly the case the rewritten
// migration has to survive.
const ABANDONED_WHEN = 1_786_968_581_807
const ABANDONED_TAG = '0033_push_reader_preferences'
const ABANDONED_SQL = `-- Reader push preference rows are expand-only and empty at deploy time.
CREATE TABLE "push_reader_preferences" (
\t"reader_id" text PRIMARY KEY NOT NULL,
\t"content_post" boolean DEFAULT true NOT NULL,
\t"content_note" boolean DEFAULT true NOT NULL,
\t"content_recently" boolean DEFAULT true NOT NULL,
\t"comment_replied" boolean DEFAULT true NOT NULL,
\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,
\t"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "push_reader_preferences" ADD CONSTRAINT "push_reader_preferences_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;`

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

const readJournal = (): { entries: JournalEntry[] } =>
  JSON.parse(
    fs.readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  )

const pushBindingEntry = () => {
  const { entries } = readJournal()
  const entry = entries.find((candidate) => candidate.idx === 33)
  if (!entry) throw new Error('migration 33 is missing from the journal')
  return { entry, entries }
}

/**
 * Replay history up to (but excluding) the rewritten migration, then hand-apply
 * the abandoned revision so the ledger holds a hash no bundled file matches.
 */
const folderWithAbandonedRevision = () => {
  const { entry, entries } = pushBindingEntry()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-push-migration-'))
  fs.mkdirSync(path.join(dir, 'meta'), { recursive: true })

  const priorEntries = entries.filter((candidate) => candidate.idx < entry.idx)
  for (const prior of priorEntries) {
    fs.copyFileSync(
      path.join(migrationsDir, `${prior.tag}.sql`),
      path.join(dir, `${prior.tag}.sql`),
    )
  }
  fs.writeFileSync(path.join(dir, `${ABANDONED_TAG}.sql`), ABANDONED_SQL)
  fs.writeFileSync(
    path.join(dir, 'meta', '_journal.json'),
    JSON.stringify(
      {
        version: '7',
        dialect: 'postgresql',
        entries: [
          ...priorEntries,
          {
            idx: entry.idx,
            version: '7',
            when: ABANDONED_WHEN,
            tag: ABANDONED_TAG,
            breakpoints: true,
          },
        ],
      },
      null,
      2,
    ),
  )
  return dir
}

const ownerColumn = async (pool: { query: any }) => {
  const result = await pool.query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name = 'push_relay_bindings' AND column_name = 'owner_id'`,
  )
  return result.rows[0]?.is_nullable ?? null
}

const ownerDeleteRule = async (pool: { query: any }) => {
  const result = await pool.query(
    `SELECT rc.delete_rule
     FROM information_schema.referential_constraints rc
     JOIN information_schema.table_constraints tc
       ON tc.constraint_name = rc.constraint_name
     WHERE tc.table_name = 'push_relay_bindings'
       AND tc.constraint_name = 'push_relay_bindings_owner_id_readers_id_fk'`,
  )
  return result.rows[0]?.delete_rule ?? null
}

const preferencesTable = async (pool: { query: any }) => {
  const result = await pool.query(
    `SELECT to_regclass('public.push_reader_preferences') AS reg`,
  )
  return result.rows[0]?.reg ?? null
}

describe('push relay binding owner migration', () => {
  it('is journalled after the abandoned revision it replaces', () => {
    const { entry } = pushBindingEntry()
    expect(entry.when).toBeGreaterThan(ABANDONED_WHEN)
  })

  it('relaxes owner_id on a database that never saw the abandoned revision', async () => {
    const context = await createPgTestDatabase('mx_push_owner_fresh')
    try {
      await expect(ownerColumn(context.pool)).resolves.toBe('YES')
      await expect(ownerDeleteRule(context.pool)).resolves.toBe('SET NULL')
      await expect(preferencesTable(context.pool)).resolves.toBeNull()
    } finally {
      await context.close()
    }
  }, 120_000)

  it('still runs after a database applied the abandoned preferences revision', async () => {
    const context = await createPgTestDatabase('mx_push_owner_replayed', {
      migrate: false,
    })
    try {
      await runSchemaMigrationFiles(context.pool, folderWithAbandonedRevision())
      await expect(preferencesTable(context.pool)).resolves.toBe(
        'push_reader_preferences',
      )

      await runSchemaMigrationFiles(context.pool, migrationsDir)

      await expect(ownerColumn(context.pool)).resolves.toBe('YES')
      await expect(ownerDeleteRule(context.pool)).resolves.toBe('SET NULL')
      await expect(preferencesTable(context.pool)).resolves.toBeNull()
    } finally {
      await context.close()
    }
  }, 180_000)
})
