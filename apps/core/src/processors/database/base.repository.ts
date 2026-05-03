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
 * Convert a Snowflake `bigint` ID coming out of drizzle into the public
 * `EntityId` decimal-string contract. Use at every repository boundary.
 */
export function toEntityId(value: bigint | null | undefined): EntityId | null {
  if (value === null || value === undefined) return null
  return serializeEntityId(value)
}

/**
 * Convert an incoming string/EntityId into the bigint that the repository
 * uses to query PostgreSQL. Throws on malformed input.
 */
export function toBigInt(value: EntityId | string): bigint {
  return parseEntityId(value)
}

export function toBigIntOrNull(
  value: EntityId | string | null | undefined,
): bigint | null {
  if (value === null || value === undefined) return null
  return parseEntityId(value)
}

/**
 * Common base for PostgreSQL-backed repositories. Subclasses receive the
 * shared drizzle handle through DI and use the helpers above to translate
 * between the bigint ↔ EntityId boundary at every method.
 */
export abstract class BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) protected readonly db: AppDatabase) {}

  protected toBigInt = toBigInt
  protected toBigIntOrNull = toBigIntOrNull
  protected toEntityId = toEntityId

  protected paginationOf(
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
}
