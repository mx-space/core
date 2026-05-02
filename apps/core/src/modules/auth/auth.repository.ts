import { Inject, Injectable } from '@nestjs/common'
import { and, eq, lte, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  accounts,
  apiKeys,
  passkeys,
  sessions,
  verifications,
} from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface AccountRow {
  id: EntityId
  userId: EntityId
  accountId: string | null
  providerId: string
  providerAccountId: string | null
  password: string | null
  type: string | null
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scope: string | null
  idToken: string | null
  raw: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date | null
}

export interface SessionRow {
  id: EntityId
  userId: EntityId
  token: string
  expiresAt: Date | null
  ipAddress: string | null
  userAgent: string | null
  provider: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface ApiKeyRow {
  id: EntityId
  userId: EntityId | null
  referenceId: EntityId | null
  configId: string | null
  name: string | null
  key: string
  start: string | null
  prefix: string | null
  enabled: boolean
  rateLimitEnabled: boolean
  requestCount: number
  expiresAt: Date | null
  lastRequest: Date | null
  permissions: unknown
  metadata: unknown
  createdAt: Date
  updatedAt: Date | null
}

const mapAccount = (row: typeof accounts.$inferSelect): AccountRow => ({
  id: toEntityId(row.id) as EntityId,
  userId: toEntityId(row.userId) as EntityId,
  accountId: row.accountId,
  providerId: row.providerId,
  providerAccountId: row.providerAccountId,
  password: row.password,
  type: row.type,
  accessToken: row.accessToken,
  refreshToken: row.refreshToken,
  accessTokenExpiresAt: row.accessTokenExpiresAt,
  refreshTokenExpiresAt: row.refreshTokenExpiresAt,
  scope: row.scope,
  idToken: row.idToken,
  raw: row.raw,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const mapSession = (row: typeof sessions.$inferSelect): SessionRow => ({
  id: toEntityId(row.id) as EntityId,
  userId: toEntityId(row.userId) as EntityId,
  token: row.token,
  expiresAt: row.expiresAt,
  ipAddress: row.ipAddress,
  userAgent: row.userAgent,
  provider: row.provider,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const mapApiKey = (row: typeof apiKeys.$inferSelect): ApiKeyRow => ({
  id: toEntityId(row.id) as EntityId,
  userId: row.userId ? (toEntityId(row.userId) as EntityId) : null,
  referenceId: row.referenceId
    ? (toEntityId(row.referenceId) as EntityId)
    : null,
  configId: row.configId,
  name: row.name,
  key: row.key,
  start: row.start,
  prefix: row.prefix,
  enabled: row.enabled,
  rateLimitEnabled: row.rateLimitEnabled,
  requestCount: row.requestCount,
  expiresAt: row.expiresAt,
  lastRequest: row.lastRequest,
  permissions: row.permissions,
  metadata: row.metadata,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class AuthRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  // ── accounts ─────────────────────────────────────────────────────────

  async findAccountByProvider(
    providerId: string,
    providerAccountId: string,
  ): Promise<AccountRow | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.providerId, providerId),
          eq(accounts.providerAccountId, providerAccountId),
        )!,
      )
      .limit(1)
    return row ? mapAccount(row) : null
  }

  async findAccountsForUser(userId: EntityId | string): Promise<AccountRow[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, parseEntityId(userId)))
    return rows.map(mapAccount)
  }

  async createAccount(input: {
    userId: EntityId | string
    providerId: string
    providerAccountId?: string | null
    password?: string | null
    type?: string | null
    accessToken?: string | null
    refreshToken?: string | null
    accessTokenExpiresAt?: Date | null
    refreshTokenExpiresAt?: Date | null
    scope?: string | null
    idToken?: string | null
    raw?: Record<string, unknown> | null
  }): Promise<AccountRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(accounts)
      .values({
        id,
        userId: parseEntityId(input.userId),
        providerId: input.providerId,
        providerAccountId: input.providerAccountId ?? null,
        password: input.password ?? null,
        type: input.type ?? null,
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
        scope: input.scope ?? null,
        idToken: input.idToken ?? null,
        raw: input.raw ?? null,
      })
      .returning()
    return mapAccount(row)
  }

  async updateAccountPassword(
    id: EntityId | string,
    password: string,
  ): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(accounts)
      .set({ password, updatedAt: new Date() })
      .where(eq(accounts.id, idBig))
  }

  // ── sessions ─────────────────────────────────────────────────────────

  async findSessionByToken(token: string): Promise<SessionRow | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1)
    return row ? mapSession(row) : null
  }

  async createSession(input: {
    userId: EntityId | string
    token: string
    expiresAt?: Date | null
    ipAddress?: string | null
    userAgent?: string | null
    provider?: string | null
  }): Promise<SessionRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(sessions)
      .values({
        id,
        userId: parseEntityId(input.userId),
        token: input.token,
        expiresAt: input.expiresAt ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        provider: input.provider ?? null,
      })
      .returning()
    return mapSession(row)
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await this.db
      .delete(sessions)
      .where(eq(sessions.token, token))
      .returning({ id: sessions.id })
    return result.length > 0
  }

  async deleteExpiredSessions(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(sessions)
      .where(lte(sessions.expiresAt, now))
      .returning({ id: sessions.id })
    return result.length
  }

  // ── api keys ─────────────────────────────────────────────────────────

  async findApiKey(key: string): Promise<ApiKeyRow | null> {
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1)
    return row ? mapApiKey(row) : null
  }

  async listApiKeysForUser(userId: EntityId | string): Promise<ApiKeyRow[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, parseEntityId(userId)))
    return rows.map(mapApiKey)
  }

  async createApiKey(input: {
    userId?: EntityId | string | null
    referenceId?: EntityId | string | null
    configId?: string | null
    name?: string | null
    key: string
    start?: string | null
    prefix?: string | null
    enabled?: boolean
    rateLimitEnabled?: boolean
    expiresAt?: Date | null
    permissions?: unknown
    metadata?: unknown
  }): Promise<ApiKeyRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        id,
        userId: input.userId ? parseEntityId(input.userId) : null,
        referenceId: input.referenceId
          ? parseEntityId(input.referenceId)
          : null,
        configId: input.configId ?? null,
        name: input.name ?? null,
        key: input.key,
        start: input.start ?? null,
        prefix: input.prefix ?? null,
        enabled: input.enabled ?? true,
        rateLimitEnabled: input.rateLimitEnabled ?? false,
        expiresAt: input.expiresAt ?? null,
        permissions: input.permissions,
        metadata: input.metadata,
      })
      .returning()
    return mapApiKey(row)
  }

  async incrementApiKeyUsage(id: EntityId | string): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(apiKeys)
      .set({
        requestCount: sql`${apiKeys.requestCount} + 1`,
        lastRequest: new Date(),
      })
      .where(eq(apiKeys.id, idBig))
  }

  async deleteApiKey(id: EntityId | string): Promise<boolean> {
    const idBig = parseEntityId(id)
    const result = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.id, idBig))
      .returning({ id: apiKeys.id })
    return result.length > 0
  }

  // ── verifications (Better Auth uses these for email flows) ───────────

  async createVerification(input: {
    identifier: string
    value: string
    expiresAt: Date
  }): Promise<{
    id: EntityId
    identifier: string
    value: string
    expiresAt: Date
  }> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(verifications)
      .values({
        id,
        identifier: input.identifier,
        value: input.value,
        expiresAt: input.expiresAt,
      })
      .returning()
    return {
      id: toEntityId(row.id) as EntityId,
      identifier: row.identifier,
      value: row.value,
      expiresAt: row.expiresAt,
    }
  }

  async findVerification(
    identifier: string,
  ): Promise<{ id: EntityId; value: string; expiresAt: Date } | null> {
    const [row] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, identifier))
      .limit(1)
    if (!row) return null
    return {
      id: toEntityId(row.id) as EntityId,
      value: row.value,
      expiresAt: row.expiresAt,
    }
  }

  async deleteVerification(identifier: string): Promise<boolean> {
    const result = await this.db
      .delete(verifications)
      .where(eq(verifications.identifier, identifier))
      .returning({ id: verifications.id })
    return result.length > 0
  }

  // ── passkeys ─────────────────────────────────────────────────────────

  async findPasskeyByCredentialId(credentialId: string) {
    const [row] = await this.db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, credentialId))
      .limit(1)
    if (!row) return null
    return {
      id: toEntityId(row.id) as EntityId,
      userId: toEntityId(row.userId) as EntityId,
      name: row.name,
      credentialId: row.credentialId,
      publicKey: row.publicKey,
      counter: row.counter,
      deviceType: row.deviceType,
      backedUp: row.backedUp,
      transports: row.transports,
      aaguid: row.aaguid,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async createPasskey(input: {
    userId: EntityId | string
    name?: string | null
    credentialId: string
    publicKey: string
    counter?: number
    deviceType?: string | null
    backedUp?: boolean
    transports?: string[] | null
    aaguid?: string | null
  }): Promise<EntityId> {
    const id = this.snowflake.nextBigInt()
    await this.db.insert(passkeys).values({
      id,
      userId: parseEntityId(input.userId),
      name: input.name ?? null,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter ?? 0,
      deviceType: input.deviceType ?? null,
      backedUp: input.backedUp ?? false,
      transports: input.transports ?? null,
      aaguid: input.aaguid ?? null,
    })
    return toEntityId(id) as EntityId
  }

  async incrementPasskeyCounter(credentialId: string, by = 1): Promise<void> {
    await this.db
      .update(passkeys)
      .set({ counter: sql`${passkeys.counter} + ${by}` })
      .where(eq(passkeys.credentialId, credentialId))
  }

  async deletePasskey(credentialId: string): Promise<boolean> {
    const result = await this.db
      .delete(passkeys)
      .where(eq(passkeys.credentialId, credentialId))
      .returning({ id: passkeys.id })
    return result.length > 0
  }
}
