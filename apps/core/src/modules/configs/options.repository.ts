import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { options } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { CONFIG_UPGRADE_LOCK } from '~/shared/config-lock'
import { type EntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { OptionRow } from './options.types'

const mapRow = (row: typeof options.$inferSelect): OptionRow => ({
  id: toEntityId(row.id) as EntityId,
  name: row.name,
  value: row.value,
})

@Injectable()
export class OptionsRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async withConfigLock<T>(
    work: (repository: OptionsRepository) => Promise<T>,
    afterCommit?: (value: T) => Promise<void>,
  ): Promise<T> {
    const client = await (
      this.db as AppDatabase & { $client: Pool }
    ).$client.connect()
    let committed = false
    let locked = false
    let destroy = false
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL lock_timeout = '10s'")
      await client.query('SELECT pg_advisory_lock($1::bigint)', [
        CONFIG_UPGRADE_LOCK,
      ])
      locked = true
      const scopedDb = drizzle(client, { casing: 'snake_case' }) as AppDatabase
      const value = await work(new OptionsRepository(scopedDb, this.snowflake))
      await client.query('COMMIT')
      committed = true
      await afterCommit?.(value)
      return value
    } catch (error) {
      if (!committed)
        await client.query('ROLLBACK').catch(() => {
          destroy = true
        })
      throw error
    } finally {
      if (locked)
        await client
          .query('SELECT pg_advisory_unlock($1::bigint)', [CONFIG_UPGRADE_LOCK])
          .catch(() => {
            destroy = true
          })
      client.release(destroy)
    }
  }

  async findAll(): Promise<OptionRow[]> {
    const rows = await this.db.select().from(options).orderBy(options.name)
    return rows.map(mapRow)
  }

  async get<T = unknown>(name: string): Promise<T | null> {
    const [row] = await this.db
      .select()
      .from(options)
      .where(eq(options.name, name))
      .limit(1)
    return row ? (row.value as T) : null
  }

  async upsert<T>(name: string, value: T): Promise<OptionRow> {
    const [existing] = await this.db
      .select()
      .from(options)
      .where(eq(options.name, name))
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(options)
        .set({ value: value as unknown })
        .where(eq(options.id, existing.id))
        .returning()
      return mapRow(row)
    }
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(options)
      .values({ id, name, value: value as unknown })
      .returning()
    return mapRow(row)
  }

  async increment(name: string, delta = 1): Promise<OptionRow> {
    const current = await this.get<number>(name)
    const next = Number(current ?? 0) + delta
    return this.upsert(name, next)
  }

  async deleteByName(name: string): Promise<OptionRow | null> {
    const [row] = await this.db
      .delete(options)
      .where(eq(options.name, name))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(options)
    return Number(row?.count ?? 0)
  }
}
