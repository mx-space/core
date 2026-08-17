import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULT_PUSH_PREFERENCES } from '@mx-space/push-protocol'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../migrations',
)

describe('push_bindings forward migration', () => {
  it('adds a new 0002 migration without editing 0001', async () => {
    const files = await readdir(migrationsDir)
    expect(files).toContain('0001_initial.sql')
    expect(files).toContain('0002_binding_reader_preferences.sql')
  })

  it('adds nullable reader_id and non-null preferences defaulting to all-true protocol keys', async () => {
    const sql = await readFile(
      join(migrationsDir, '0002_binding_reader_preferences.sql'),
      'utf8',
    )

    expect(sql).toMatch(
      /ADD COLUMN(?: IF NOT EXISTS)? reader_id text(?!\s+NOT NULL)/,
    )
    expect(sql).toMatch(/preferences\s+jsonb\s+not null/i)
    expect(sql).toContain(JSON.stringify(DEFAULT_PUSH_PREFERENCES))
    expect(sql).not.toMatch(/reader_id\s+text\s+not null/i)
  })
})
