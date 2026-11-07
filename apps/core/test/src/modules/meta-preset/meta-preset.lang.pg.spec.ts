import { SnowflakeGenerator } from '@mx-space/db-schema/id'
import * as schema from '@mx-space/db-schema/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  MetaFieldType,
  MetaPresetScope,
} from '~/modules/meta-preset/meta-preset.enum'
import { MetaPresetRepository } from '~/modules/meta-preset/meta-preset.repository'
import { MetaPresetService } from '~/modules/meta-preset/meta-preset.service'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { SnowflakeService } from '~/shared/id/snowflake.service'

describe('meta preset lang builtin (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let service: MetaPresetService

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri(), max: 4 })
    const db = drizzle(pool, { schema }) as unknown as AppDatabase
    const snowflake = new SnowflakeGenerator({
      workerId: 47,
    }) as unknown as SnowflakeService
    service = new MetaPresetService(new MetaPresetRepository(db, snowflake))
    await service.onModuleInit()
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('seeds lang as an enabled language preset for both scopes', async () => {
    const lang = (await service.findAll()).find(
      (preset) => preset.key === 'lang',
    )

    expect(lang).toBeTruthy()
    expect(lang!.type).toBe(MetaFieldType.Language)
    expect(lang!.scope).toBe(MetaPresetScope.Both)
    expect(lang!.enabled).toBe(true)
    expect(lang!.isBuiltin).toBe(true)
    expect((lang!.options ?? []).map((option) => option.value)).toEqual(
      expect.arrayContaining(['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP']),
    )

    expect(
      (await service.findAll(MetaPresetScope.Post, true)).some(
        (preset) => preset.key === 'lang',
      ),
    ).toBe(true)
    expect(
      (await service.findAll(MetaPresetScope.Note, true)).some(
        (preset) => preset.key === 'lang',
      ),
    ).toBe(true)
  })

  it('does not duplicate the preset on the next boot', async () => {
    await service.onModuleInit()

    const langs = (await service.findAll()).filter(
      (preset) => preset.key === 'lang',
    )
    expect(langs).toHaveLength(1)
  })
})
