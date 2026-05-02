import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, lte, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { serverlessLogs, serverlessStorages } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface ServerlessStorageRow {
  id: EntityId
  namespace: string
  key: string
  value: unknown
}

export interface ServerlessLogRow {
  id: EntityId
  functionId: EntityId | null
  reference: string
  name: string
  method: string | null
  ip: string | null
  status: string
  executionTime: number
  logs: unknown[] | null
  error: Record<string, unknown> | null
  createdAt: Date
}

const mapStorage = (
  row: typeof serverlessStorages.$inferSelect,
): ServerlessStorageRow => ({
  id: toEntityId(row.id) as EntityId,
  namespace: row.namespace,
  key: row.key,
  value: row.value,
})

const mapLog = (row: typeof serverlessLogs.$inferSelect): ServerlessLogRow => ({
  id: toEntityId(row.id) as EntityId,
  functionId: row.functionId ? (toEntityId(row.functionId) as EntityId) : null,
  reference: row.reference,
  name: row.name,
  method: row.method,
  ip: row.ip,
  status: row.status,
  executionTime: row.executionTime,
  logs: row.logs,
  error: row.error,
  createdAt: row.createdAt,
})

@Injectable()
export class ServerlessStorageRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async listNamespace(namespace: string): Promise<ServerlessStorageRow[]> {
    const rows = await this.db
      .select()
      .from(serverlessStorages)
      .where(eq(serverlessStorages.namespace, namespace))
    return rows.map(mapStorage)
  }

  async get(namespace: string, key: string): Promise<unknown | null> {
    const [row] = await this.db
      .select()
      .from(serverlessStorages)
      .where(
        and(
          eq(serverlessStorages.namespace, namespace),
          eq(serverlessStorages.key, key),
        )!,
      )
      .limit(1)
    return row ? row.value : null
  }

  async upsert(
    namespace: string,
    key: string,
    value: unknown,
  ): Promise<ServerlessStorageRow> {
    const [existing] = await this.db
      .select()
      .from(serverlessStorages)
      .where(
        and(
          eq(serverlessStorages.namespace, namespace),
          eq(serverlessStorages.key, key),
        )!,
      )
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(serverlessStorages)
        .set({ value })
        .where(eq(serverlessStorages.id, existing.id))
        .returning()
      return mapStorage(row)
    }
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(serverlessStorages)
      .values({ id, namespace, key, value })
      .returning()
    return mapStorage(row)
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    const result = await this.db
      .delete(serverlessStorages)
      .where(
        and(
          eq(serverlessStorages.namespace, namespace),
          eq(serverlessStorages.key, key),
        )!,
      )
      .returning({ id: serverlessStorages.id })
    return result.length > 0
  }

  async deleteNamespace(namespace: string): Promise<number> {
    const result = await this.db
      .delete(serverlessStorages)
      .where(eq(serverlessStorages.namespace, namespace))
      .returning({ id: serverlessStorages.id })
    return result.length
  }
}

@Injectable()
export class ServerlessLogRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(
    params: {
      page?: number
      size?: number
      functionId?: EntityId | string
      reference?: string
      name?: string
      status?: string
    } = {},
  ): Promise<PaginationResult<ServerlessLogRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 50))
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (params.functionId) {
      filters.push(
        eq(serverlessLogs.functionId, parseEntityId(params.functionId)),
      )
    }
    if (params.reference) {
      filters.push(eq(serverlessLogs.reference, params.reference))
    }
    if (params.name) filters.push(eq(serverlessLogs.name, params.name))
    if (params.status) filters.push(eq(serverlessLogs.status, params.status))
    const where = filters.length > 0 ? and(...filters) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(serverlessLogs)
        .where(where)
        .orderBy(desc(serverlessLogs.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(serverlessLogs)
        .where(where),
    ])
    return {
      data: rows.map(mapLog),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async record(input: {
    functionId?: EntityId | string | null
    reference: string
    name: string
    method?: string | null
    ip?: string | null
    status: string
    executionTime: number
    logs?: unknown[] | null
    error?: Record<string, unknown> | null
  }): Promise<ServerlessLogRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(serverlessLogs)
      .values({
        id,
        functionId: input.functionId ? parseEntityId(input.functionId) : null,
        reference: input.reference,
        name: input.name,
        method: input.method ?? null,
        ip: input.ip ?? null,
        status: input.status,
        executionTime: input.executionTime,
        logs: input.logs ?? null,
        error: input.error ?? null,
      })
      .returning()
    return mapLog(row)
  }

  async findLogById(id: EntityId | string): Promise<ServerlessLogRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(serverlessLogs)
      .where(eq(serverlessLogs.id, idBig))
      .limit(1)
    return row ? mapLog(row) : null
  }

  async deleteOlderThan(threshold: Date): Promise<number> {
    const result = await this.db
      .delete(serverlessLogs)
      .where(lte(serverlessLogs.createdAt, threshold))
      .returning({ id: serverlessLogs.id })
    return result.length
  }
}
