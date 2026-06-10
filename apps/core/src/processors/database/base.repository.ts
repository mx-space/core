import { Inject } from '@nestjs/common'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  type EntityId,
  parseEntityId,
  serializeEntityId,
} from '~/shared/id/entity-id'

import type { AppDatabase } from './postgres.provider'

export interface PaginationParams {
  page?: number
  size?: number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    currentPage: number
    totalPage: number
    total: number
    size: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/**
 * Validate a Snowflake text ID coming out of drizzle before it crosses the
 * repository boundary.
 */
export function toEntityId(
  value: EntityId | string | null | undefined,
): EntityId | null {
  if (value === null || value === undefined) return null
  return serializeEntityId(value)
}

/**
 * Validate an incoming string/EntityId before using it in PostgreSQL queries.
 * The database stores Snowflake IDs as text, not bigint.
 */
export function toDbId(value: EntityId | string): EntityId {
  return parseEntityId(value)
}

export function toDbIdOrNull(
  value: EntityId | string | null | undefined,
): EntityId | null {
  if (value === null || value === undefined) return null
  return parseEntityId(value)
}

export function paginationOf(
  total: number,
  page: number,
  size: number,
): PaginationResult<never>['pagination'] {
  const totalPage = Math.max(1, Math.ceil(total / size))
  return {
    currentPage: page,
    totalPage,
    total,
    size,
    hasNextPage: page < totalPage,
    hasPrevPage: page > 1,
  }
}

/**
 * Common base for PostgreSQL-backed repositories. Subclasses receive the
 * shared drizzle handle through DI and use the helpers above to validate
 * Snowflake text IDs at every method boundary.
 */
export abstract class BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) protected readonly db: AppDatabase) {}

  protected toDbId = toDbId
  protected toDbIdOrNull = toDbIdOrNull
  protected toEntityId = toEntityId

  protected paginationOf = paginationOf
}
